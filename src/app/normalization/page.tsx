"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import TopNavBar from "@/components/nav/TopNavBar";
import { CampusEdge } from "@/types/road";
import {
  calculateNormalizedMetrics,
  WeightFactors,
  NormalizationSummary,
} from "@/lib/math/normalizeEngine";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function NormalizationPage() {
  const [edges, setEdges] = useState<CampusEdge[]>([]);
  const [classCode] = useState<string>("CLASS_2026_A");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 다기준 가중치 슬라이더 상태 (합 = 1.0)
  const [weights, setWeights] = useState<WeightFactors>({
    wDist: 0.4,
    wSlope: 0.3,
    wSolar: 0.3,
  });

  // PAPS 등급/목적별 프리셋 적용
  const handleApplyPreset = (type: "paps5" | "paps1" | "shortest") => {
    if (type === "paps5") {
      // 심폐지구력 취약자(4~5등급): 경사 및 땡볕 최소화
      setWeights({ wDist: 0.2, wSlope: 0.5, wSolar: 0.3 });
    } else if (type === "paps1") {
      // 최우수 러너(1등급): 직진 단축 경로 선호
      setWeights({ wDist: 0.7, wSlope: 0.15, wSolar: 0.15 });
    } else {
      // 균형 기준
      setWeights({ wDist: 0.34, wSlope: 0.33, wSolar: 0.33 });
    }
  };

  useEffect(() => {
    const fetchEdges = async () => {
      setIsLoading(true);
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("campus_edges")
          .select("*")
          .eq("class_code", classCode);

        if (data) {
          const list: CampusEdge[] = data.map((row: any) => ({
            id: row.id,
            source: row.source_id,
            target: row.target_id,
            distance: Number(row.distance ?? row.length_m ?? 0),
            slope: Number(row.slope ?? 0.0),
            delta_h: 0,
            surface_type: row.surface_type || "asphalt_new",
            albedo: Number(row.albedo ?? 0.15),
            is_shaded: Boolean(row.is_shaded),
            effective_solar: Number(row.effective_solar ?? 650),
            r_abs: Number(row.r_abs ?? 500),
            team_id: row.team_id || "ALL",
          }));
          setEdges(list);
        }
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEdges();
  }, [classCode]);

  const summary: NormalizationSummary = calculateNormalizedMetrics(edges, weights);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50">
      <TopNavBar currentPath="/normalization" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* 차시 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="font-mono text-xs font-bold text-sky-600">
                5차시 [수학② 본시 실습]
              </span>
              <h1 className="text-xl font-bold text-slate-800">
                다기준 Min-Max 정규화 및 주행 비용(Cost) 산출
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                물리 차원이 다른 실거리(m), 경사도(%), 흡수열량(W/m²)을 0~1 구간으로 변환하여 맞춤형 종합 비용을 계산합니다.
              </p>
            </div>
            <Link
              href="/topology"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← 위상 진단실로 복귀
            </Link>
          </div>

          {/* 상단 제어 패널: 가중치 조정 및 프리셋 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 거리 가중치 슬라이더 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">📏 실거리 가중치 (w_dist)</span>
                <span className="text-sky-600 font-mono">{weights.wDist.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.wDist}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, wDist: Number(e.target.value) }))
                }
                className="w-full accent-sky-600"
              />
              <span className="text-[10px] text-slate-400 block">
                최소: {summary.distRange.min.toFixed(1)}m ~ 최대: {summary.distRange.max.toFixed(1)}m
              </span>
            </div>

            {/* 경사도 가중치 슬라이더 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">⛰️ 오르막 경사 가중치 (w_slope)</span>
                <span className="text-amber-600 font-mono">{weights.wSlope.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.wSlope}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, wSlope: Number(e.target.value) }))
                }
                className="w-full accent-amber-600"
              />
              <span className="text-[10px] text-slate-400 block">
                최소: {summary.slopeRange.min.toFixed(1)}% ~ 최대: {summary.slopeRange.max.toFixed(1)}%
              </span>
            </div>

            {/* 복사열 가중치 슬라이더 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">☀️ 복사열부하 가중치 (w_solar)</span>
                <span className="text-rose-600 font-mono">{weights.wSolar.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.wSolar}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, wSolar: Number(e.target.value) }))
                }
                className="w-full accent-rose-600"
              />
              <span className="text-[10px] text-slate-400 block">
                최소: {Math.round(summary.rAbsRange.min)} ~ 최대: {Math.round(summary.rAbsRange.max)} W/m²
              </span>
            </div>
          </div>

          {/* 프리셋 버튼 바 */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100/70 px-4 py-2 text-xs">
            <span className="font-semibold text-slate-600">PAPS 신체 등급별 가중치 프리셋:</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleApplyPreset("paps5")}
                className="rounded bg-rose-50 border border-rose-200 px-3 py-1 font-bold text-rose-700 hover:bg-rose-100"
              >
                PAPS 4~5등급 (관절·열부하 완화 코스)
              </button>
              <button
                onClick={() => handleApplyPreset("paps1")}
                className="rounded bg-sky-50 border border-sky-200 px-3 py-1 font-bold text-sky-700 hover:bg-sky-100"
              >
                PAPS 1~2등급 (기동성·단축 거리 우선)
              </button>
              <button
                onClick={() => handleApplyPreset("shortest")}
                className="rounded bg-white border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                균등 가중치 (1:1:1)
              </button>
            </div>
          </div>

          {/* 정규화 매핑 데이터 표 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-800">
                도로 간선별 정규화 및 통합 비용(Cost) 산출표 ({summary.items.length}건)
              </span>
              <span className="font-mono text-xs text-slate-400">
                수식: Cost = (w_dist × L_norm) + (w_slope × S_norm) + (w_solar × R_norm)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-left font-mono text-xs text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50">
                    <th className="py-2 px-3">간선 ID</th>
                    <th className="px-3">구간</th>
                    <th className="px-3">실거리(m)</th>
                    <th className="px-3">L_norm</th>
                    <th className="px-3">경사도(%)</th>
                    <th className="px-3">S_norm</th>
                    <th className="px-3">R_abs(W/m²)</th>
                    <th className="px-3">R_norm</th>
                    <th className="px-3 font-bold text-sky-700 bg-sky-50/50">종합 Cost (비용)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.items.map((row) => (
                    <tr key={row.edgeId} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-2 px-3 font-semibold text-slate-700">{row.edgeId}</td>
                      <td className="px-3">{row.source} ➔ {row.target}</td>
                      <td className="px-3">{row.distance.toFixed(1)}m</td>
                      <td className="px-3 text-slate-500">{row.distNorm.toFixed(3)}</td>
                      <td className="px-3">{row.slope.toFixed(1)}%</td>
                      <td className="px-3 text-slate-500">{row.slopeNorm.toFixed(3)}</td>
                      <td className="px-3">{Math.round(row.r_abs)}</td>
                      <td className="px-3 text-slate-500">{row.rAbsNorm.toFixed(3)}</td>
                      <td className="px-3 font-bold text-sky-600 bg-sky-50/50">
                        {row.totalCost.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}