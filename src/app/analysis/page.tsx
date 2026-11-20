"use client";

import React, { useState, useEffect, useCallback } from "react";
import TopNavBar from "@/components/nav/TopNavBar";
import { CampusEdge, SurfaceType } from "@/types/road";
import { getSurfaceAlbedo } from "@/lib/physics/albedoMap";
import { calculateAbsorbedRadiation } from "@/lib/physics/radiationEngine";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const SURFACE_LABELS: Record<string, string> = {
  asphalt_new: "신설 아스팔트",
  asphalt_old: "노후 아스팔트",
  concrete: "콘크리트/보도블록",
  urethane: "우레탄 트랙",
  dirt: "마사토/흙길",
  grass: "자연 잔디",
};

type SampleCategory = "track_flat" | "asphalt_steep" | "shaded_trail";

const SAMPLE_CATEGORIES: {
  key: SampleCategory;
  title: string;
  criteria: string;
  desc: string;
}[] = [
  {
    key: "track_flat",
    title: "대조군 A: 평지 완충 트랙 (기준선)",
    criteria: "경사도 2% 미만, 우레탄/잔디/흙길 우선",
    desc: "지형 경사와 열부하가 최소화된 상태에서 학생의 기본 주행 심박수를 측정하는 기준 구간입니다.",
  },
  {
    key: "asphalt_steep",
    title: "대조군 B: 직사광선 급경사 아스팔트 (고부하군)",
    criteria: "경사도 5% 이상 오르막, 비차광 아스팔트/콘크리트",
    desc: "낮은 알베도로 인한 복사열 흡수와 중력 저항이 결합될 때의 심박 급증 현상을 검증하는 구간입니다.",
  },
  {
    key: "shaded_trail",
    title: "대조군 C: 수목 그늘 차광 보행로 (열저감군)",
    criteria: "수목 차광(70% 감면) 적용 구간",
    desc: "직달일사 차단이 실제 러닝 체감 온도와 심폐 피로도 완화에 미치는 효과를 비교하는 구간입니다.",
  },
];

export default function AnalysisPage() {
  const [classCode, setClassCode] = useState<string>("CLASS_2026_A");
  const [userName, setUserName] = useState<string>("학생");
  const [edges, setEdges] = useState<CampusEdge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 선택된 3대 대조 구간 edge_id
  const [selectedSamples, setSelectedSamples] = useState<Record<SampleCategory, string>>({
    track_flat: "",
    asphalt_steep: "",
    shaded_trail: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("papsrun_user");
      if (saved) {
        const user = JSON.parse(saved);
        if (user.classCode && user.classCode !== "ALL") setClassCode(user.classCode);
        if (user.name) setUserName(user.name);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. 1차시 간선 데이터 로드
      const { data: edgeData } = await supabase
        .from("campus_edges")
        .select("*")
        .eq("class_code", classCode);

      if (edgeData) {
        const parsed: CampusEdge[] = edgeData.map((row: any) => {
          const surface = (row.surface_type === "asphalt" ? "asphalt_new" : row.surface_type || "asphalt_new") as SurfaceType;
          const albedo = Number(row.albedo ?? getSurfaceAlbedo(surface));
          const effSolar = Number(row.effective_solar ?? 650.0);
          return {
            id: row.id,
            source: row.source_id,
            target: row.target_id,
            distance: Number(row.distance ?? row.length_m ?? 0),
            slope: Number(row.slope ?? 0),
            delta_h: Math.round(((row.target_elevation ?? 30) - (row.source_elevation ?? 30)) * 10) / 10,
            surface_type: surface,
            albedo,
            is_shaded: Boolean(row.is_shaded),
            effective_solar: effSolar,
            r_abs: Number(row.r_abs ?? calculateAbsorbedRadiation(effSolar, albedo)),
            team_id: row.team_id || "ALL",
          };
        });
        setEdges(parsed);
      }

      // 2. 기존 저장된 3대 대조 구간 로드
      const { data: sampleData } = await supabase
        .from("sample_segments")
        .select("*")
        .eq("class_code", classCode);

      if (sampleData && sampleData.length > 0) {
        const nextSamples: Record<SampleCategory, string> = {
          track_flat: "",
          asphalt_steep: "",
          shaded_trail: "",
        };
        sampleData.forEach((row: any) => {
          if (row.category in nextSamples) {
            nextSamples[row.category as SampleCategory] = row.edge_id;
          }
        });
        setSelectedSamples(nextSamples);
      }
    } catch (e) {
      console.error("2차시 분석 데이터 로드 실패:", e);
    } finally {
      setIsLoading(false);
    }
  }, [classCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 조건에 맞는 후보 간선 자동 추천 기능
  const handleAutoRecommend = () => {
    if (edges.length === 0) return;

    // A: 가장 평탄하고 완충된 구간
    const flatCandidate = [...edges].sort((a, b) => {
      const aScore = Math.abs(a.slope) + (["urethane", "grass", "dirt"].includes(a.surface_type) ? -5 : 0);
      const bScore = Math.abs(b.slope) + (["urethane", "grass", "dirt"].includes(b.surface_type) ? -5 : 0);
      return aScore - bScore;
    })[0];

    // B: 흡수 복사에너지와 오르막 경사가 가장 높은 구간
    const steepCandidate = [...edges].sort(
      (a, b) => (b.r_abs ?? 0) + Math.abs(b.slope) * 20 - ((a.r_abs ?? 0) + Math.abs(a.slope) * 20)
    )[0];

    // C: 차광이 적용된 구간 중 흡수 복사에너지가 가장 낮은 구간
    const shadedList = edges.filter((e) => e.is_shaded);
    const shadedCandidate =
      shadedList.length > 0
        ? [...shadedList].sort((a, b) => (a.r_abs ?? 0) - (b.r_abs ?? 0))[0]
        : [...edges].sort((a, b) => (a.r_abs ?? 0) - (b.r_abs ?? 0))[0];

    setSelectedSamples({
      track_flat: flatCandidate?.id || "",
      asphalt_steep: steepCandidate?.id || "",
      shaded_trail: shadedCandidate?.id || "",
    });
  };

  // 3대 대조 구간 DB 확정 저장
  const handleSaveSamples = async () => {
    if (!selectedSamples.track_flat || !selectedSamples.asphalt_steep || !selectedSamples.shaded_trail) {
      alert("3개 대조 구간(A, B, C)을 모두 선택해 주세요.");
      return;
    }

    if (!isSupabaseConfigured()) {
      alert("로컬 모드에서는 임시 반영만 가능합니다.");
      return;
    }

    setIsSaving(true);
    try {
      const upsertRows = (Object.keys(selectedSamples) as SampleCategory[]).map((cat) => {
        const edgeObj = edges.find((e) => e.id === selectedSamples[cat])!;
        return {
          class_code: classCode,
          category: cat,
          edge_id: edgeObj.id,
          source_id: edgeObj.source,
          target_id: edgeObj.target,
          distance: edgeObj.distance,
          slope: edgeObj.slope,
          surface_type: edgeObj.surface_type,
          albedo: edgeObj.albedo,
          r_abs: edgeObj.r_abs ?? 500,
          is_shaded: edgeObj.is_shaded,
          selected_by: userName,
        };
      });

      const { error } = await supabase
        .from("sample_segments")
        .upsert(upsertRows, { onConflict: "class_code,category" });

      if (error) throw error;
      alert("3차시 체육 심박수 실측을 위한 3대 대조 구간이 확정 저장되었습니다.");
    } catch (err: any) {
      alert("저장 실패: " + (err.message || "오류 발생"));
    } finally {
      setIsSaving(false);
    }
  };

  // 피복별 통계 집계
  const surfaceStats = Object.keys(SURFACE_LABELS).map((typeKey) => {
    const matched = edges.filter((e) => e.surface_type === typeKey);
    const count = matched.length;
    const totalLen = matched.reduce((acc, cur) => acc + cur.distance, 0);
    const avgRabs =
      count > 0
        ? matched.reduce((acc, cur) => acc + (cur.r_abs ?? 0), 0) / count
        : 0;
    const albedo = getSurfaceAlbedo(typeKey as SurfaceType);

    return {
      typeKey,
      label: SURFACE_LABELS[typeKey],
      albedo,
      count,
      totalLen,
      avgRabs,
    };
  });

  const maxRabs = Math.max(...surfaceStats.map((s) => s.avgRabs), 650);

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50">
      <TopNavBar currentPath="/analysis" />

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 상단 헤더 */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="font-mono text-xs font-bold text-sky-600">
                2차시 [지구과학② 미기후 및 복사에너지 탐구]
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                노면 피복별 복사열부하 분석 및 3차시 실측 대조 구간 선정
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                1차시 지형 작도 데이터에서 알베도(α)에 따른 순흡수 복사에너지(R_abs) 차이를 검증하고 야외 실측 표본 3곳을 확정합니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500">학급 코드:</span>
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                className="w-32 rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs font-bold uppercase"
              />
              <button
                onClick={loadData}
                disabled={isLoading}
                className="px-3 py-1 text-xs font-semibold bg-white border rounded border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                데이터 동기화
              </button>
            </div>
          </div>

          {/* 1. 피복별 알베도 및 순흡수 복사에너지 비교 차트 & 테이블 */}
          <section className="p-5 space-y-4 bg-white border shadow-sm rounded-xl border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  노면 피복 유형별 반사율(Albedo) 및 평균 흡수 복사에너지(W/m²) 비교
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  수식: R_abs = I_eff × (1 - α) (직달일사량 기준, 수목 차광 시 70% 감면 반영)
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                분석 대상 간선: {edges.length}구간
              </span>
            </div>

            {/* 가로 막대 시각화 */}
            <div className="space-y-2.5 pt-1">
              {surfaceStats.map((stat) => {
                const widthPct = stat.count > 0 ? Math.min(100, (stat.avgRabs / maxRabs) * 100) : 0;
                return (
                  <div key={stat.typeKey} className="grid items-center grid-cols-12 gap-3 text-xs">
                    <div className="col-span-3 font-semibold truncate text-slate-700">
                      {stat.label}{" "}
                      <span className="font-mono text-[11px] text-slate-400">
                        (α={stat.albedo.toFixed(2)})
                      </span>
                    </div>
                    <div className="relative h-5 col-span-6 overflow-hidden rounded-md bg-slate-100">
                      {stat.count > 0 ? (
                        <div
                          className={`h-full transition-all duration-500 ${
                            stat.avgRabs >= 550
                              ? "bg-rose-500"
                              : stat.avgRabs >= 450
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 pl-2 leading-5">
                          작도된 구간 없음
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-right font-mono text-[11px] text-slate-600">
                      {stat.count > 0 ? (
                        <>
                          <strong className="text-slate-900">{stat.avgRabs.toFixed(1)} W/m²</strong>{" "}
                          <span className="text-slate-400">({stat.count}구간)</span>
                        </>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. 3차시 체육 심박수 실측을 위한 3대 대조 구간 선정 */}
          <section className="p-5 space-y-4 bg-white border shadow-sm rounded-xl border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-[11px] font-bold text-indigo-600">
                  3차시 체육 교과 연계 실험 설계
                </span>
                <h2 className="text-sm font-bold text-slate-800">
                  야외 심박수 실측 3대 대조 구간 확정
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  환경 조건(경사·노면·차광)이 인체 심폐 부하(BPM)에 미치는 영향을 검증할 대표 구간 3곳을 지정합니다.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAutoRecommend}
                  disabled={edges.length === 0}
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  조건별 최적 후보 자동 추천
                </button>
                <button
                  onClick={handleSaveSamples}
                  disabled={isSaving || edges.length === 0}
                  className="rounded-md bg-sky-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:bg-slate-300"
                >
                  {isSaving ? "저장 중..." : "3대 대조 구간 확정 저장"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {SAMPLE_CATEGORIES.map((cat) => {
                const selectedEdge = edges.find((e) => e.id === selectedSamples[cat.key]);
                return (
                  <div
                    key={cat.key}
                    className="flex flex-col justify-between p-4 space-y-3 border rounded-lg border-slate-200 bg-slate-50/60"
                  >
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-900">{cat.title}</h3>
                      <span className="inline-block rounded bg-white border border-slate-200 px-2 py-0.5 font-mono text-[10px] text-sky-700">
                        선정 기준: {cat.criteria}
                      </span>
                      <p className="text-[11px] leading-relaxed text-slate-500 pt-1">
                        {cat.desc}
                      </p>
                    </div>

                    <div className="pt-2 space-y-2 border-t border-slate-200">
                      <select
                        value={selectedSamples[cat.key]}
                        onChange={(e) =>
                          setSelectedSamples((prev) => ({
                            ...prev,
                            [cat.key]: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-sky-500 focus:outline-none"
                      >
                        <option value="">-- 간선 구간 선택 --</option>
                        {edges.map((edge) => (
                          <option key={edge.id} value={edge.id}>
                            [{edge.source}→{edge.target}] {SURFACE_LABELS[edge.surface_type] || edge.surface_type} / {edge.distance.toFixed(0)}m / 경사 {edge.slope > 0 ? "+" : ""}{edge.slope.toFixed(1)}% / {Math.round(edge.r_abs ?? 500)}W/m²
                          </option>
                        ))}
                      </select>

                      {selectedEdge && (
                        <div className="p-2.5 bg-white rounded border border-sky-200 font-mono text-[11px] text-slate-700 space-y-0.5">
                          <div>
                            <strong>구간:</strong> {selectedEdge.source} → {selectedEdge.target} ({selectedEdge.distance.toFixed(1)}m)
                          </div>
                          <div>
                            <strong>피복/알베도:</strong> {SURFACE_LABELS[selectedEdge.surface_type]} (α={selectedEdge.albedo})
                          </div>
                          <div>
                            <strong>경사도:</strong> {selectedEdge.slope > 0 ? "+" : ""}{selectedEdge.slope.toFixed(1)}% |{" "}
                            <strong>흡수복사:</strong> {Math.round(selectedEdge.r_abs ?? 500)} W/m²
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}