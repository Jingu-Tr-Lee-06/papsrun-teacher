"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import TopNavBar from "@/components/nav/TopNavBar";
import { CampusNode, CampusEdge } from "@/types/road";
import { analyzeTopology, TopologyReport } from "@/lib/gis/topologyEngine";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const TopologyMapCanvas = dynamic(
  () => import("@/components/map/TopologyMapCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 font-mono text-xs text-slate-500">
        위상수학 시각화 엔진 초기화 중...
      </div>
    ),
  }
);

export default function TopologyPage() {
  const [nodes, setNodes] = useState<Record<string, CampusNode>>({});
  const [edges, setEdges] = useState<Record<string, CampusEdge>>({});
  const [report, setReport] = useState<TopologyReport | null>(null);
  const [classCode] = useState<string>("CLASS_2026_A");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Supabase 데이터 로드 및 위상 진단 실행
  const fetchAndDiagnose = async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: nodeData } = await supabase
        .from("campus_nodes")
        .select("*")
        .eq("class_code", classCode);

      const nodeMap: Record<string, CampusNode> = {};
      if (nodeData) {
        nodeData.forEach((row: any) => {
          nodeMap[row.id] = {
            id: row.id,
            lat: Number(row.lat),
            lng: Number(row.lng),
            elevation: Number(row.elevation ?? 30.0),
          };
        });
      }

      const { data: edgeData } = await supabase
        .from("campus_edges")
        .select("*")
        .eq("class_code", classCode);

      const edgeMap: Record<string, CampusEdge> = {};
      if (edgeData) {
        edgeData.forEach((row: any) => {
          edgeMap[row.id] = {
            id: row.id,
            source: row.source_id,
            target: row.target_id,
            distance: Number(row.distance ?? row.length_m ?? 0),
            slope: Number(row.slope ?? 0.0),
            delta_h: 0,
            surface_type: row.surface_type || "asphalt_new",
            albedo: Number(row.albedo ?? 0.15),
            is_shaded: Boolean(row.is_shaded),
            effective_solar: 650,
            r_abs: 500,
            team_id: row.team_id || "ALL",
          };
        });
      }

      setNodes(nodeMap);
      setEdges(edgeMap);

      // 위상수학 결함 진단 연산
      const diagResult = analyzeTopology(nodeMap, edgeMap);
      setReport(diagResult);
    } catch (e) {
      console.error("위상 데이터 진단 실패:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAndDiagnose();
  }, [classCode]);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50">
      <TopNavBar currentPath="/topology" />

      <div className="relative flex flex-1 overflow-hidden">
        {/* 지도 시각화 */}
        <main className="relative h-full flex-1">
          <TopologyMapCanvas nodes={nodes} edges={edges} report={report} />

          <div className="absolute top-4 left-4 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur">
            <span className="block text-[11px] font-bold text-slate-500">지도 범례</span>
            <div className="mt-1 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-700">
                <span className="inline-block h-3 w-3 rounded-full bg-[#0284c7]" /> 주요 연결망
              </span>
              <span className="flex items-center gap-1 text-rose-600 font-semibold">
                <span className="inline-block h-3 w-3 rounded-full bg-rose-500" /> 고립 노드 (0개 연결)
              </span>
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-500" /> 데드엔드 (1개 연결)
              </span>
            </div>
          </div>
        </main>

        {/* 우측 위상 진단 보고서 패널 */}
        <aside className="z-10 flex w-96 flex-col border-l border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm overflow-y-auto">
          <div className="border-b border-slate-200 pb-3">
            <span className="font-mono text-[11px] font-bold text-indigo-600">
              5차시 [수학 본시 실습]
            </span>
            <h2 className="text-base font-bold text-slate-800">
              도로망 위상(Topology) 결함 진단기
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              그래프 연결 컴포넌트 및 막다른 길 무결성 검증
            </p>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* 종합 위상 점수 카드 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <span className="text-[11px] font-semibold text-slate-500">통합 도로망 위상 무결성 점수</span>
              <div className="mt-1 text-3xl font-extrabold font-mono text-slate-800">
                <span className={report?.topologyScore === 100 ? "text-emerald-600" : report && report.topologyScore >= 70 ? "text-amber-500" : "text-rose-600"}>
                  {report?.topologyScore ?? 0}
                </span>
                <span className="text-base font-normal text-slate-400"> / 100점</span>
              </div>
              <span className="mt-1.5 inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold border border-slate-200 text-slate-600">
                {report?.isFullyConnected ? "✅ 완전 연결 그래프 (탐색 가능)" : "⚠️ 단절 결함 발견 (보정 필요)"}
              </span>
            </div>

            {/* 기본 수치 요약 */}
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <span className="text-[10px] text-slate-400 block">총 교차점(노드)</span>
                <span className="font-bold text-slate-700 text-sm">{report?.totalNodes ?? 0}개</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <span className="text-[10px] text-slate-400 block">총 도로(간선)</span>
                <span className="font-bold text-slate-700 text-sm">{report?.totalEdges ?? 0}개</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <span className="text-[10px] text-slate-400 block">분리된 구역 수</span>
                <span className={`font-bold text-sm ${report && report.componentCount > 1 ? "text-rose-600" : "text-emerald-600"}`}>
                  {report?.componentCount ?? 0}개
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <span className="text-[10px] text-slate-400 block">고립 노드 수</span>
                <span className={`font-bold text-sm ${report && report.isolatedNodeIds.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {report?.isolatedNodeIds.length ?? 0}개
                </span>
              </div>
            </div>

            {/* 검출된 결함 목록 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <span className="font-bold text-slate-700 block">🔍 상세 진단 내역</span>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                {report?.issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-slate-400">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 작업 제어 버튼 */}
            <div className="space-y-2 pt-2">
              <button
                onClick={fetchAndDiagnose}
                disabled={isLoading}
                className="w-full rounded-lg bg-indigo-600 py-2 font-bold text-white transition hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {isLoading ? "위상 재진단 중..." : "🔄 위상 진단 새로고침"}
              </button>

              <Link
                href="/workspace"
                className="block text-center w-full rounded-lg border border-slate-200 bg-white py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ✏️ 1차시 워크스페이스로 이동하여 보정 작도하기
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}