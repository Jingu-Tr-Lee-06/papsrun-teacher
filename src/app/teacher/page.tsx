"use client";

import React, { useState, useEffect, useCallback } from "react";
import TopNavBar from "../../components/nav/TopNavBar";
import LeafletMapCanvas from "../../components/map/LeafletMapCanvas";
import { CampusNode, CampusEdge, SurfaceType } from "../../types/road";
import {
  validateCampusTopology,
  TopologyReport,
} from "../../lib/graph/topologyValidator";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

export default function TeacherPage() {
  const [classCode, setClassCode] = useState<string>("CLASS_2026_A");
  const [nodes, setNodes] = useState<Record<string, CampusNode>>({});
  const [edges, setEdges] = useState<Record<string, CampusEdge>>({});

  // 도로망 작도 잠금 상태 플래그
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // 위상 진단 보고서
  const [topologyReport, setTopologyReport] = useState<TopologyReport | null>(null);

  // 1. 학급 도로망 데이터 동기화
  const loadClassData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    // 간선 데이터 조회
    const { data: edgeData } = await supabase
      .from("campus_edges")
      .select("*")
      .eq("class_code", classCode);

    // 세션 잠금 상태 조회
    const { data: sessionData } = await supabase
      .from("class_sessions")
      .select("is_locked")
      .eq("class_code", classCode)
      .single();

    if (sessionData) {
      setIsLocked(Boolean(sessionData.is_locked));
    }

    if (edgeData) {
      const edgeMap: Record<string, CampusEdge> = {};
      const nodeMap: Record<string, CampusNode> = {};

      edgeData.forEach((row: any) => {
        const dist = Number(row.distance ?? row.length_m ?? 0);
        edgeMap[row.id] = {
          id: row.id,
          source: row.source_id,
          target: row.target_id,
          distance: dist,
          slope: Number(row.slope ?? 0.0),
          surface_type: row.surface_type as SurfaceType,
          albedo: Number(row.albedo ?? 0.15),
          is_shaded: Boolean(row.is_shaded),
          effective_solar: Number(row.effective_solar ?? 650.0),
          r_abs: Number(row.r_abs ?? 500.0),
          team_id: row.team_id || "TEAM_1",
        };

        nodeMap[row.source_id] = {
          id: row.source_id,
          lat: Number(row.source_lat),
          lng: Number(row.source_lng),
          elevation: Number(row.source_elevation ?? 30.0),
        };

        nodeMap[row.target_id] = {
          id: row.target_id,
          lat: Number(row.target_lat),
          lng: Number(row.target_lng),
          elevation: Number(row.target_elevation ?? 30.0),
        };
      });

      setEdges(edgeMap);
      setNodes(nodeMap);

      // 로드 직후 위상 무결성 자동 진단
      const report = validateCampusTopology(nodeMap, edgeMap);
      setTopologyReport(report);
    }
  }, [classCode]);

  useEffect(() => {
    loadClassData();
  }, [loadClassData]);

  // 2. 작도 권한 잠금/해제 제어
  const toggleSessionLock = async () => {
    const nextLockState = !isLocked;
    setIsLocked(nextLockState);

    if (isSupabaseConfigured()) {
      await supabase
        .from("class_sessions")
        .upsert({ class_code: classCode, is_locked: nextLockState });
    }
  };

  // 3. 위상 무결성 수동 재검사
  const handleRunValidation = () => {
    const report = validateCampusTopology(nodes, edges);
    setTopologyReport(report);
  };

  // 4. 단일 JSON 최종 배포 추출
  const handleExportFinalJson = () => {
    const payload = {
      class_code: classCode,
      verified_at: new Date().toISOString(),
      is_locked: isLocked,
      topology_summary: {
        is_valid: topologyReport?.isValid ?? false,
        component_count: topologyReport?.componentCount ?? 0,
        isolated_nodes: topologyReport?.isolatedNodeIds ?? [],
      },
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campus_roads_${classCode}_final.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50">
      <TopNavBar currentPath="/teacher" />

      <div className="relative flex flex-1 overflow-hidden">
        {/* 중앙 관제 지도 캔버스 */}
        <main className="relative h-full flex-1">
          <LeafletMapCanvas
            nodes={nodes}
            edges={edges}
            activePoints={[]}
            snapState={null}
            onMapClick={() => {}}
            onMouseMove={() => {}}
          />
        </main>

        {/* 우측 관제 및 위상 진단 사이드바 */}
        <aside className="z-10 flex w-96 flex-col border-l border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-800">
              교사 통합 관제 대시보드
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              학급 실시간 작도 통제 및 네트워크 위상 무결성 검증
            </p>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* 학급 코드 및 데이터 갱신 */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">관제 대상 학급</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs focus:border-sky-500 focus:outline-none"
                />
                <button
                  onClick={loadClassData}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  동기화
                </button>
              </div>
            </div>

            {/* 작도 세션 잠금 제어 */}
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block font-semibold text-slate-700">학생 작도 권한</span>
                  <span className="text-[11px] text-slate-500">
                    {isLocked ? "현재 잠금 상태 (편집 불가)" : "현재 편집 허용 상태"}
                  </span>
                </div>
                <button
                  onClick={toggleSessionLock}
                  className={`rounded px-3 py-1 text-xs font-semibold text-white transition ${
                    isLocked
                      ? "bg-slate-600 hover:bg-slate-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {isLocked ? "작도 잠금 해제" : "작도 권한 잠금"}
                </button>
              </div>
            </div>

            {/* 위상 진단 보고서 (5차시 수학과 연계) */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">그래프 위상 진단 결과</span>
                <button
                  onClick={handleRunValidation}
                  className="text-xs font-semibold text-sky-600 hover:underline"
                >
                  재검사 실행
                </button>
              </div>

              {topologyReport ? (
                <div className="space-y-2">
                  <div
                    className={`rounded p-2.5 text-xs font-medium border ${
                      topologyReport.isValid
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {topologyReport.isValid
                      ? "도로망 완전 연결 상태 (단일 컴포넌트 검증 완료)"
                      : "도로망 결함 검출 (단절 또는 고립 노드 존재)"}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-slate-700 font-mono">
                    <div className="rounded border border-slate-200 p-2">
                      <span className="block text-[11px] text-slate-400">네트워크 덩어리</span>
                      <span className="text-sm font-bold">
                        {topologyReport.componentCount}개
                      </span>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <span className="block text-[11px] text-slate-400">고립 노드 수</span>
                      <span className="text-sm font-bold text-amber-600">
                        {topologyReport.isolatedNodeIds.length}개
                      </span>
                    </div>
                  </div>

                  {topologyReport.diagnosticMessages.length > 0 && (
                    <ul className="rounded border border-slate-200 bg-slate-50 p-2.5 space-y-1 text-[11px] text-slate-600 font-mono">
                      {topologyReport.diagnosticMessages.map((msg, idx) => (
                        <li key={idx}>- {msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="p-3 text-center text-slate-400 font-mono text-[11px]">
                  진단 데이터를 불러오는 중...
                </div>
              )}
            </div>
          </div>

          {/* 하단 최종 JSON 내보내기 */}
          <div className="mt-auto border-t border-slate-200 pt-4">
            <button
              onClick={handleExportFinalJson}
              className="w-full rounded bg-sky-600 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
            >
              검증 완료 도로망 JSON 최종 추출
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}