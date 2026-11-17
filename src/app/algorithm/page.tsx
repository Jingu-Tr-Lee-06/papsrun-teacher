"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import TopNavBar from "@/components/nav/TopNavBar";
import { CampusNode, CampusEdge } from "@/types/road";
import {
  generateDijkstraSteps,
  DijkstraStep,
  DijkstraSimulationResult,
} from "@/lib/algorithms/dijkstraStepEngine";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const AlgorithmMapCanvas = dynamic(
  () => import("@/components/map/AlgorithmMapCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full font-mono text-xs bg-slate-100 text-slate-500">
        다익스트라 시뮬레이션 지도 초기화 중...
      </div>
    ),
  }
);

export default function AlgorithmPage() {
  const [nodes, setNodes] = useState<Record<string, CampusNode>>({});
  const [edges, setEdges] = useState<Record<string, CampusEdge>>({});
  const [classCode] = useState<string>("CLASS_2026_A");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [startNodeId, setStartNodeId] = useState<string>("");
  const [targetNodeId, setTargetNodeId] = useState<string>("");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Supabase 도로망 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: nData } = await supabase
          .from("campus_nodes")
          .select("*")
          .eq("class_code", classCode);

        const nodeMap: Record<string, CampusNode> = {};
        if (nData && nData.length > 0) {
          nData.forEach((row: any) => {
            nodeMap[row.id] = {
              id: row.id,
              lat: Number(row.lat),
              lng: Number(row.lng),
              elevation: Number(row.elevation ?? 30.0),
            };
          });
          setNodes(nodeMap);
          const firstKey = Object.keys(nodeMap)[0];
          const lastKey = Object.keys(nodeMap)[Object.keys(nodeMap).length - 1];
          setStartNodeId(firstKey);
          setTargetNodeId(lastKey);
        }

        const { data: eData } = await supabase
          .from("campus_edges")
          .select("*")
          .eq("class_code", classCode);

        const edgeMap: Record<string, CampusEdge> = {};
        if (eData) {
          eData.forEach((row: any) => {
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
          setEdges(edgeMap);
        }
      } catch (e) {
        console.error("데이터 로드 실패:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [classCode]);

  // 다익스트라 단계별 시뮬레이션 결과 메모이제이션
  const simulation: DijkstraSimulationResult | null = useMemo(() => {
    if (!startNodeId || Object.keys(nodes).length === 0) return null;
    return generateDijkstraSteps(nodes, edges, startNodeId, targetNodeId);
  }, [nodes, edges, startNodeId, targetNodeId]);

  // 출발/도착 변경 시 스텝 리셋
  useEffect(() => {
    setCurrentStepIndex(0);
  }, [startNodeId, targetNodeId]);

  const currentStep: DijkstraStep | null =
    simulation && simulation.steps.length > 0
      ? simulation.steps[currentStepIndex] || simulation.steps[0]
      : null;

  const totalSteps = simulation?.steps.length || 0;

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleNodeSelectFromMap = (nodeId: string) => {
    if (!startNodeId) {
      setStartNodeId(nodeId);
    } else if (!targetNodeId || targetNodeId === nodeId) {
      setTargetNodeId(nodeId);
    } else {
      setStartNodeId(nodeId);
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50">
      <TopNavBar currentPath="/algorithm" />

      <div className="relative flex flex-1 overflow-hidden">
        {/* 지도 시각화 뷰포트 */}
        <main className="relative flex-1 h-full">
          <AlgorithmMapCanvas
            nodes={nodes}
            edges={edges}
            startNodeId={startNodeId}
            targetNodeId={targetNodeId}
            currentStep={currentStep}
            shortestPath={simulation?.shortestPath || []}
            onNodeSelect={handleNodeSelectFromMap}
          />

          {/* 지도 위 현재 단계 설명 플로팅 바 */}
          {currentStep && (
            <div className="absolute top-4 left-4 right-4 z-20 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="font-mono text-xs font-bold text-sky-600">
                  Step {currentStepIndex + 1} / {totalSteps}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  현재 기준 노드: <span className="font-mono font-bold text-sky-700">{currentStep.currentNodeId ?? "없음"}</span>
                </span>
              </div>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700">
                {currentStep.description}
              </p>
            </div>
          )}
        </main>

        {/* 우측 알고리즘 탐구 컨트롤러 & D[v] 테이블 */}
        <aside className="z-10 flex flex-col p-4 overflow-y-auto border-l shadow-sm w-96 border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="pb-3 border-b border-slate-200">
            <span className="font-mono text-[11px] font-bold text-sky-600">
              6차시 [정보 본시 실습]
            </span>
            <h2 className="text-base font-bold text-slate-800">
              다익스트라 알고리즘 시각 탐구실
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              그리디(Greedy) 선택과 간선 완화(Relaxation) 원리 학습
            </p>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* 출발 및 도착 노드 설정 */}
            <div className="p-3 space-y-2 border rounded-xl border-slate-200 bg-slate-50/70">
              <span className="block font-bold text-slate-700">🎯 탐색 구간 설정</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">시작 노드 (출발)</label>
                  <select
                    value={startNodeId}
                    onChange={(e) => setStartNodeId(e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono font-bold text-emerald-700 focus:outline-none"
                  >
                    {Object.keys(nodes).map((nid) => (
                      <option key={nid} value={nid}>{nid}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">목표 노드 (도착)</label>
                  <select
                    value={targetNodeId}
                    onChange={(e) => setTargetNodeId(e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono font-bold text-rose-700 focus:outline-none"
                  >
                    {Object.keys(nodes).map((nid) => (
                      <option key={nid} value={nid}>{nid}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 단계별 실행 컨트롤러 */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2.5">
              <span className="block font-bold text-sky-900">⚡ 알고리즘 재생 컨트롤러</span>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  className="flex-1 py-2 font-bold transition bg-white border rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300"
                >
                  ◀ 이전 단계
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={currentStepIndex >= totalSteps - 1}
                  className="flex-1 py-2 font-bold text-white transition rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300"
                >
                  다음 단계 ▶
                </button>
              </div>

              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={() => setCurrentStepIndex(0)}
                  className="flex-1 rounded border border-slate-200 bg-white py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  처음으로
                </button>
                <button
                  onClick={() => setCurrentStepIndex(totalSteps - 1)}
                  className="flex-1 rounded border border-slate-200 bg-white py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  최종 결과로 점프
                </button>
              </div>
            </div>

            {/* 실시간 최단거리 테이블 D[v] */}
            <div className="p-3 space-y-2 bg-white border shadow-sm rounded-xl border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">거리 배열 테이블 D[v]</span>
                <span className="text-[10px] text-slate-400">확정 노드: {currentStep?.visitedNodes.length ?? 0}개</span>
              </div>

              <div className="overflow-y-auto max-h-56">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="py-1">노드</th>
                      <th>누적 최단거리</th>
                      <th>직전 노드</th>
                      <th>방문 상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(nodes).map((nid) => {
                      const dist = currentStep?.distances[nid];
                      const prev = currentStep?.previousNodes[nid];
                      const isVisited = currentStep?.visitedNodes.includes(nid);
                      const isCurrent = currentStep?.currentNodeId === nid;

                      return (
                        <tr
                          key={nid}
                          className={`border-b border-slate-50 ${
                            isCurrent
                              ? "bg-amber-50 font-bold text-amber-900"
                              : isVisited
                              ? "bg-sky-50/50 text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          <td className="py-1 font-semibold">{nid}</td>
                          <td>{dist === Infinity ? "∞" : `${dist?.toFixed(1)}m`}</td>
                          <td>{prev ?? "-"}</td>
                          <td>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${
                              isCurrent
                                ? "bg-amber-200 text-amber-800"
                                : isVisited
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-500"
                            }`}>
                              {isCurrent ? "진행 중" : isVisited ? "확정(S)" : "대기"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 최종 도출된 최단 경로 요약 */}
            {simulation && simulation.shortestPath.length > 0 && (
              <div className="p-3 space-y-1 border rounded-xl border-emerald-200 bg-emerald-50/60">
                <span className="block text-xs font-bold text-emerald-900">🏁 최종 도출 최단 경로</span>
                <div className="font-mono text-[11px] text-emerald-800 break-words">
                  {simulation.shortestPath.join(" ➔ ")}
                </div>
                <div className="text-[10px] text-slate-500 pt-1">
                  총 이동 거리: <strong>{simulation.finalDistances[targetNodeId]?.toFixed(1)}m</strong>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}