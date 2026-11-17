"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import TopNavBar from "@/components/nav/TopNavBar";
import { CampusNode, CampusEdge } from "@/types/road";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function AdminPage() {
  const [classCode, setClassCode] = useState<string>("CLASS_2026_A");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [nodes, setNodes] = useState<CampusNode[]>([]);
  const [edges, setEdges] = useState<CampusEdge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingLock, setIsUpdatingLock] = useState<boolean>(false);

  // 학급 데이터 및 세션 잠금 상태 로드
  const fetchAdminData = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. 수업 세션 잠금 상태 확인
      const { data: sessionData } = await supabase
        .from("class_sessions")
        .select("is_locked")
        .eq("class_code", classCode)
        .maybeSingle();

      if (sessionData) {
        setIsLocked(Boolean(sessionData.is_locked));
      }

      // 2. 노드 데이터 수집
      const { data: nodeData } = await supabase
        .from("campus_nodes")
        .select("*")
        .eq("class_code", classCode);

      if (nodeData) {
        setNodes(
          nodeData.map((row: any) => ({
            id: row.id,
            lat: Number(row.lat),
            lng: Number(row.lng),
            elevation: Number(row.elevation ?? 30.0),
          }))
        );
      }

      // 3. 간선 데이터 수집
      const { data: edgeData } = await supabase
        .from("campus_edges")
        .select("*")
        .eq("class_code", classCode);

      if (edgeData) {
        setEdges(
          edgeData.map((row: any) => ({
            id: row.id,
            source: row.source_id,
            target: row.target_id,
            distance: Number(row.distance ?? row.length_m ?? 0),
            slope: Number(row.slope ?? 0.0),
            delta_h: Math.round(((row.target_elevation ?? 30) - (row.source_elevation ?? 30)) * 10) / 10,
            surface_type: row.surface_type || "asphalt_new",
            albedo: Number(row.albedo ?? 0.15),
            is_shaded: Boolean(row.is_shaded),
            effective_solar: Number(row.effective_solar ?? 650),
            r_abs: Number(row.r_abs ?? 500),
            team_id: row.team_id || "ALL",
          }))
        );
      }
    } catch (e) {
      console.error("관제 데이터 로드 실패:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [classCode]);

  // 수업 제어 인터락 토글 (실시간 학생 화면 동결)
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

  // 학급 전체 데이터 백업 CSV 다운로드
  const handleExportBackupCsv = () => {
    if (edges.length === 0) {
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

    const rows = edges.map((e) =>
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

  // 피복 통계 집계
  const surfaceCounts = edges.reduce((acc, cur) => {
    acc[cur.surface_type] = (acc[cur.surface_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalLengthKm = (edges.reduce((acc, cur) => acc + cur.distance, 0) / 1000).toFixed(2);
  const steepSlopeCount = edges.filter((e) => Math.abs(e.slope) >= 8).length;
  const shadedCount = edges.filter((e) => e.is_shaded).length;

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50">
      <TopNavBar currentPath="/admin" />

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 헤더 바 */}
          <div className="flex flex-col justify-between gap-4 pb-4 border-b md:flex-row md:items-center border-slate-200">
            <div>
              <span className="font-mono text-xs font-bold text-sky-600">
                교사 관제 시스템 (Teacher Control Console)
              </span>
              <h1 className="text-xl font-bold text-slate-800">
                학급 실시간 작도 관제 및 수업 제어 인터락
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                수업 단계 전환 시 학생 화면을 실시간으로 잠그거나 데이터를 취합합니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold text-slate-600">학급 코드:</span>
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                className="w-36 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:border-sky-500 focus:outline-none"
              />
              <button
                onClick={fetchAdminData}
                disabled={isLoading}
                className="px-3 py-1 text-xs font-semibold bg-white border rounded border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                🔄 새로고침
              </button>
            </div>
          </div>

          {/* 🔥 핵심 수업 제어 인터락 스위치 */}
          <div className={`rounded-xl border p-5 transition-all shadow-sm ${
            isLocked ? "border-amber-300 bg-amber-50/70" : "border-emerald-300 bg-emerald-50/70"
          }`}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${isLocked ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`} />
                  <h2 className="text-base font-bold text-slate-800">
                    {isLocked ? "수업 작도 권한 동결 중 (Locked)" : "실시간 학생 작도 개방 중 (Unlocked)"}
                  </h2>
                </div>
                <p className="text-xs text-slate-600">
                  {isLocked
                    ? "모든 학생의 지도 클릭 및 수정 권한이 차단되어 읽기 전용 상태로 동결되어 있습니다."
                    : "학생들이 자유롭게 캠퍼스 지도에 핀을 찍고 도로를 확정할 수 있습니다."}
                </p>
              </div>

              <button
                onClick={handleToggleLock}
                disabled={isUpdatingLock}
                className={`rounded-lg px-5 py-2.5 text-xs font-bold text-white shadow-md transition ${
                  isLocked
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                } disabled:bg-slate-300`}
              >
                {isUpdatingLock
                  ? "상태 동기화 중..."
                  : isLocked
                  ? "🔓 수업 잠금 해제 (작도 허용)"
                  : "🔒 수업 화면 즉시 잠금 (동결)"}
              </button>
            </div>
          </div>

          {/* 학급 데이터 취합 현황 요약 카드 */}
          <div className="grid grid-cols-2 gap-4 font-mono md:grid-cols-4">
            <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
              <span className="text-[11px] text-slate-400 block font-sans">총 교차점 (Nodes)</span>
              <span className="text-2xl font-black text-slate-800">{nodes.length}개</span>
            </div>
            <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
              <span className="text-[11px] text-slate-400 block font-sans">구축 도로망 (Edges)</span>
              <span className="text-2xl font-black text-sky-600">{edges.length}구간</span>
            </div>
            <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
              <span className="text-[11px] text-slate-400 block font-sans">총 연장 거리</span>
              <span className="text-2xl font-black text-indigo-600">{totalLengthKm} km</span>
            </div>
            <div className="p-4 text-center bg-white border shadow-sm rounded-xl border-slate-200">
              <span className="text-[11px] text-slate-400 block font-sans">급경사(8%↑) 구간</span>
              <span className="text-2xl font-black text-amber-600">{steepSlopeCount}개</span>
            </div>
          </div>

          {/* 유네스코 AI 윤리: 공간적 포용성 모니터링 */}
          <div className="p-4 space-y-3 border shadow-sm rounded-xl border-sky-200 bg-sky-50/50">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-sky-900">
                  유네스코 AI 윤리 제30조: 공간적 포용성 지표 점검
                </span>
                <span className="text-[11px] text-slate-500">
                  학생들이 평지 아스팔트만 그리지 않고 그늘과 완충 노면을 골고루 매핑하고 있는지 확인합니다.
                </span>
              </div>
              <button
                onClick={handleExportBackupCsv}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 shadow-sm"
              >
                📥 학급 원본 CSV 백업
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center md:grid-cols-4">
              <div className="p-2 bg-white border rounded border-slate-200">
                <span className="text-slate-400 text-[10px] block font-sans">수목 차광 도로 비율</span>
                <span className="font-bold text-emerald-600">
                  {edges.length > 0 ? ((shadedCount / edges.length) * 100).toFixed(1) : 0}% ({shadedCount}구간)
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
          <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
            <Link
              href="/workspace"
              className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
            >
              <span className="block text-xs font-bold text-slate-800">1차시 작도 워크스페이스</span>
              <span className="text-[10px] text-slate-400">학생 지도 작도 화면으로 바로 이동</span>
            </Link>
            <Link
              href="/topology"
              className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
            >
              <span className="block text-xs font-bold text-slate-800">5차시 위상 진단실</span>
              <span className="text-[10px] text-slate-400">고립 노드 및 단절 구역 무결성 검증</span>
            </Link>
            <Link
              href="/normalization"
              className="p-3 text-center transition bg-white border rounded-lg border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
            >
              <span className="block text-xs font-bold text-slate-800">5차시 Min-Max 정규화실</span>
              <span className="text-[10px] text-slate-400">다기준 가중치 및 Cost 산출 매트릭스</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}