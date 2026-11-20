"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import TopNavBar from "@/components/nav/TopNavBar";
import StudentBulkCreator from "@/components/teacher/StudentBulkCreator";
import VibeSubmissionBoard from "@/components/teacher/VibeSubmissionBoard";
import { CampusNode, CampusEdge, SurfaceType } from "@/types/road";
import {
  validateCampusTopology,
  TopologyReport,
} from "@/lib/graph/topologyValidator";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const LeafletMapCanvas = dynamic(
  () => import("@/components/map/LeafletMapCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full font-mono text-xs bg-slate-100 text-slate-400">
        지도 캔버스 초기화 중...
      </div>
    ),
  }
);

export default function UnifiedAdminPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "topology_map">("dashboard");
  const [classCode, setClassCode] = useState<string>("CLASS_2026_A");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const [nodesMap, setNodesMap] = useState<Record<string, CampusNode>>({});
  const [edgesMap, setEdgesMap] = useState<Record<string, CampusEdge>>({});
  const [topologyReport, setTopologyReport] = useState<TopologyReport | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingLock, setIsUpdatingLock] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("papsrun_user");
      if (saved) {
        const user = JSON.parse(saved);
        if (user.classCode && user.classCode !== "ALL") {
          setClassCode(user.classCode);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchClassData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase
        .from("class_sessions")
        .select("is_locked")
        .eq("class_code", classCode)
        .maybeSingle();

      if (sessionData) {
        setIsLocked(Boolean(sessionData.is_locked));
      }

      const { data: nodeData } = await supabase
        .from("campus_nodes")
        .select("*")
        .eq("class_code", classCode);

      const nextNodes: Record<string, CampusNode> = {};
      if (nodeData) {
        nodeData.forEach((row: any) => {
          nextNodes[row.id] = {
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

      const nextEdges: Record<string, CampusEdge> = {};
      if (edgeData) {
        edgeData.forEach((row: any) => {
          const dist = Number(row.distance ?? row.length_m ?? 0);
          nextEdges[row.id] = {
            id: row.id,
            source: row.source_id,
            target: row.target_id,
            distance: dist,
            slope: Number(row.slope ?? 0.0),
            delta_h:
              Math.round(
                ((row.target_elevation ?? 30) - (row.source_elevation ?? 30)) * 10
              ) / 10,
            surface_type: (row.surface_type || "asphalt_new") as SurfaceType,
            albedo: Number(row.albedo ?? 0.15),
            is_shaded: Boolean(row.is_shaded),
            effective_solar: Number(row.effective_solar ?? 650.0),
            r_abs: Number(row.r_abs ?? 500.0),
            team_id: row.team_id || "ALL",
          };

          if (!nextNodes[row.source_id] && row.source_lat && row.source_lng) {
            nextNodes[row.source_id] = {
              id: row.source_id,
              lat: Number(row.source_lat),
              lng: Number(row.source_lng),
              elevation: Number(row.source_elevation ?? 30.0),
            };
          }
          if (!nextNodes[row.target_id] && row.target_lat && row.target_lng) {
            nextNodes[row.target_id] = {
              id: row.target_id,
              lat: Number(row.target_lat),
              lng: Number(row.target_lng),
              elevation: Number(row.target_elevation ?? 30.0),
            };
          }
        });
      }

      setNodesMap(nextNodes);
      setEdgesMap(nextEdges);

      const report = validateCampusTopology(nextNodes, nextEdges);
      setTopologyReport(report);
    } catch (e) {
      console.error("관제 데이터 로드 실패:", e);
    } finally {
      setIsLoading(false);
    }
  }, [classCode]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  const handleToggleLock = async () => {
    if (!isSupabaseConfigured() || isUpdatingLock) return;
    setIsUpdatingLock(true);

    const nextLockState = !isLocked;
    try {
      const { error } = await supabase.from("class_sessions").upsert({
        class_code: classCode,
        is_locked: nextLockState,
      });

      if (error) {
        alert("수업 잠금 상태 변경 실패: " + error.message);
      } else {
        setIsLocked(nextLockState);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingLock(false);
    }
  };

  const handleRunValidation = () => {
    const report = validateCampusTopology(nodesMap, edgesMap);
    setTopologyReport(report);
  };

  const handleExportBackupCsv = () => {
    const edgeList = Object.values(edgesMap);
    if (edgeList.length === 0) {
      alert("내보낼 간선 데이터가 없습니다.");
      return;
    }

    const headers = [
      "edge_id",
      "source_node",
      "target_node",
      "length_m",
      "surface_type",
      "albedo",
      "slope_pct",
      "is_shaded",
      "r_abs",
    ];

    const rows = edgeList.map((e) =>
      [
        e.id,
        e.source,
        e.target,
        e.distance.toFixed(1),
        e.surface_type,
        e.albedo.toFixed(2),
        e.slope.toFixed(1),
        e.is_shaded ? "TRUE" : "FALSE",
        Math.round(e.r_abs ?? 500),
      ].join(",")
    );

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PAPSrun_Admin_Backup_${classCode}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      nodes: nodesMap,
      edges: edgesMap,
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

  const nodeList = Object.values(nodesMap);
  const edgeList = Object.values(edgesMap);

  const surfaceCounts = edgeList.reduce((acc, cur) => {
    acc[cur.surface_type] = (acc[cur.surface_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalLengthKm = (
    edgeList.reduce((acc, cur) => acc + cur.distance, 0) / 1000
  ).toFixed(2);
  const steepSlopeCount = edgeList.filter((e) => Math.abs(e.slope) >= 8).length;
  const shadedCount = edgeList.filter((e) => e.is_shaded).length;

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50">
      <TopNavBar currentPath="/admin" />

      {/* 상단 통합 관제 컨트롤 바 */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-mono text-[11px] font-bold text-sky-600">
              Teacher Control & Topology Console
            </span>
            <h1 className="text-base font-bold text-slate-800">
              교사 통합 관제 센터
            </h1>
          </div>

          {/* 뷰 전환 서브 탭 */}
          <div className="flex p-1 rounded-lg bg-slate-100">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "dashboard"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              학급 통계 및 학생 관리
            </button>
            <button
              onClick={() => setActiveTab("topology_map")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "topology_map"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              실시간 지도 및 위상 무결성 검증
            </button>
          </div>
        </div>

        {/* 우측 학급 코드 및 잠금 스위치 */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-slate-500">학급:</span>
            <input
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              className="w-32 rounded border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 uppercase focus:border-sky-500 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchClassData}
            disabled={isLoading}
            className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            동기화
          </button>

          <button
            onClick={handleToggleLock}
            disabled={isUpdatingLock}
            className={`rounded px-3 py-1 text-xs font-bold text-white shadow-sm transition ${
              isLocked
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-600 hover:bg-amber-700"
            } disabled:bg-slate-300`}
          >
            {isUpdatingLock
              ? "처리 중..."
              : isLocked
              ? "작도 잠금 해제"
              : "수업 화면 즉시 잠금"}
          </button>
        </div>
      </div>

      {/* 탭 1: 학급 통계, 학생 계정 발급, 7차시 코드 제출 현황 */}
      {activeTab === "dashboard" ? (
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 수업 제어 인터락 상태 배너 */}
            <div
              className={`rounded-xl border p-4 transition-all shadow-sm ${
                isLocked
                  ? "border-amber-300 bg-amber-50/70"
                  : "border-emerald-300 bg-emerald-50/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-block h-3 w-3 rounded-full ${
                      isLocked ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      {isLocked
                        ? "수업 작도 권한 동결 중 (Locked)"
                        : "실시간 학생 작도 개방 중 (Unlocked)"}
                    </h2>
                    <p className="text-xs text-slate-600">
                      {isLocked
                        ? "모든 학생의 지도 클릭 및 수정 권한이 차단되어 읽기 전용 상태로 동결되어 있습니다."
                        : "학생들이 자유롭게 캠퍼스 지도에 핀을 찍고 도로를 확정할 수 있습니다."}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  위상 상태:{" "}
                  {topologyReport?.isValid ? (
                    <span className="text-emerald-700">완전 연결</span>
                  ) : (
                    <span className="text-amber-700">결함 확인 필요</span>
                  )}
                </span>
              </div>
            </div>

            {/* 학급 데이터 취합 현황 요약 카드 */}
            <div className="grid grid-cols-2 gap-4 font-mono md:grid-cols-4">
              <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
                <span className="text-[11px] text-slate-400 block font-sans">총 교차점 (Nodes)</span>
                <span className="text-2xl font-black text-slate-800">{nodeList.length}개</span>
              </div>
              <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
                <span className="text-[11px] text-slate-400 block font-sans">구축 도로망 (Edges)</span>
                <span className="text-2xl font-black text-sky-600">{edgeList.length}구간</span>
              </div>
              <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
                <span className="text-[11px] text-slate-400 block font-sans">총 연장 거리</span>
                <span className="text-2xl font-black text-indigo-600">{totalLengthKm} km</span>
              </div>
              <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
                <span className="text-[11px] text-slate-400 block font-sans">급경사(8% 이상) 구간</span>
                <span className="text-2xl font-black text-amber-600">{steepSlopeCount}개</span>
              </div>
            </div>

            {/* 7차시 20인 전담 Python 모듈 실시간 제출 현황판 */}
            <VibeSubmissionBoard classCode={classCode} />

            {/* 학생 계정 일괄 발급 콘솔 */}
            <StudentBulkCreator defaultClassCode={classCode} />

            {/* 유네스코 AI 윤리: 공간적 포용성 모니터링 */}
            <div className="p-4 space-y-3 border shadow-sm rounded-xl border-sky-200 bg-sky-50/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-bold text-sky-900">
                    유네스코 AI 윤리 제30조: 공간적 포용성 지표 점검
                  </span>
                  <span className="text-[11px] text-slate-500">
                    학생들이 평지 아스팔트만 그리지 않고 그늘과 완충 노면을 골고루 매핑하고 있는지 확인합니다.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportBackupCsv}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 shadow-sm"
                  >
                    학급 원본 CSV 백업
                  </button>
                  <button
                    onClick={handleExportFinalJson}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
                  >
                    검증 도로망 JSON 추출
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center md:grid-cols-4">
                <div className="p-2 bg-white border rounded border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">수목 차광 도로 비율</span>
                  <span className="font-bold text-emerald-600">
                    {edgeList.length > 0 ? ((shadedCount / edgeList.length) * 100).toFixed(1) : 0}% ({shadedCount}구간)
                  </span>
                </div>
                <div className="p-2 bg-white border rounded border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">아스팔트 노면</span>
                  <span className="font-bold text-slate-700">
                    {(surfaceCounts["asphalt_new"] || 0) + (surfaceCounts["asphalt_old"] || 0)}구간
                  </span>
                </div>
                <div className="p-2 bg-white border rounded border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">콘크리트/보도블록</span>
                  <span className="font-bold text-slate-700">{surfaceCounts["concrete"] || 0}구간</span>
                </div>
                <div className="p-2 bg-white border rounded border-slate-200">
                  <span className="text-slate-400 text-[10px] block font-sans">완충 노면 (트랙/흙/잔디)</span>
                  <span className="font-bold text-emerald-600">
                    {(surfaceCounts["urethane"] || 0) + (surfaceCounts["dirt"] || 0) + (surfaceCounts["grass"] || 0)}구간
                  </span>
                </div>
              </div>
            </div>

            {/* 차시 바로가기 퀵 내비게이션 바 */}
            <div className="grid grid-cols-2 gap-3 pt-1 md:grid-cols-5">
              <Link
                href="/workspace"
                className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="block text-xs font-bold text-slate-800">1차시 작도실</span>
                <span className="text-[10px] text-slate-400">지형 작도 워크스페이스</span>
              </Link>
              <Link
                href="/analysis"
                className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="block text-xs font-bold text-slate-800">2차시 환경·표본</span>
                <span className="text-[10px] text-slate-400">복사에너지 및 대조구간</span>
              </Link>
              <Link
                href="/topology"
                className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="block text-xs font-bold text-slate-800">5차시 위상 진단</span>
                <span className="text-[10px] text-slate-400">단절 및 고립 노드 검증</span>
              </Link>
              <Link
                href="/normalization"
                className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="block text-xs font-bold text-slate-800">5차시 정규화</span>
                <span className="text-[10px] text-slate-400">가중치 및 Cost 산출</span>
              </Link>
              <Link
                href="/vibecoding"
                className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
              >
                <span className="block text-xs font-bold text-slate-800">7차시 바이브 코딩</span>
                <span className="text-[10px] text-slate-400">AI 하네스 코딩 실습</span>
              </Link>
            </div>
          </div>
        </main>
      ) : (
        /* 탭 2: 실시간 지도 관제 및 그래프 위상 무결성 검증 */
        <div className="relative flex flex-1 overflow-hidden">
          <main className="relative flex-1 h-full">
            <LeafletMapCanvas
              nodes={nodesMap}
              edges={edgesMap}
              activePoints={[]}
              snapState={null}
              onMapClick={() => {}}
              onMouseMove={() => {}}
            />
          </main>

          <aside className="z-10 flex flex-col p-5 border-l shadow-sm w-96 border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="pb-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">
                네트워크 위상 무결성 검증
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                그래프 이론 기반 연결 요소 및 고립 노드 실시간 판별
              </p>
            </div>

            <div className="flex-1 mt-4 space-y-4 overflow-y-auto text-xs">
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
                <div className="space-y-3">
                  <div
                    className={`rounded p-3 text-xs font-medium border ${
                      topologyReport.isValid
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {topologyReport.isValid
                      ? "도로망 완전 연결 상태 (단일 컴포넌트 검증 완료)"
                      : "도로망 결함 검출 (단절 또는 고립 노드 존재)"}
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-center text-slate-700">
                    <div className="p-2.5 border rounded border-slate-200">
                      <span className="block text-[11px] text-slate-400">네트워크 덩어리</span>
                      <span className="text-base font-bold">
                        {topologyReport.componentCount}개
                      </span>
                    </div>
                    <div className="p-2.5 border rounded border-slate-200">
                      <span className="block text-[11px] text-slate-400">고립 노드 수</span>
                      <span className="text-base font-bold text-amber-600">
                        {topologyReport.isolatedNodeIds.length}개
                      </span>
                    </div>
                  </div>

                  {topologyReport.diagnosticMessages.length > 0 && (
                    <ul className="rounded border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-[11px] text-slate-600 font-mono">
                      {topologyReport.diagnosticMessages.map((msg, idx) => (
                        <li key={idx}>• {msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 font-mono text-[11px]">
                  진단 데이터를 불러오는 중...
                </div>
              )}
            </div>

            <div className="pt-4 mt-auto border-t border-slate-200">
              <button
                onClick={handleExportFinalJson}
                className="w-full py-2.5 text-xs font-bold text-white transition rounded-lg bg-sky-600 hover:bg-sky-700 shadow-sm"
              >
                검증 완료 도로망 JSON 최종 추출
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}