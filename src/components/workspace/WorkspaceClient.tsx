"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import TopNavBar from "@/components/nav/TopNavBar";
import { CampusNode, CampusEdge, SurfaceType } from "@/types/road";
import { snapToExistingNode, SnapResult } from "@/lib/gis/snapEngine";
import { getHaversineDistance } from "@/lib/gis/haversine";
import { fetchVworldElevation, calculateSlopePct } from "@/lib/gis/elevationEngine";
import { interpolatePoints } from "@/lib/gis/interpolateEngine";
import { getSurfaceAlbedo } from "@/lib/physics/albedoMap";
import {
  calculateEffectiveSolar,
  calculateAbsorbedRadiation,
} from "@/lib/physics/radiationEngine";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const LeafletMapCanvas = dynamic(
  () => import("@/components/map/LeafletMapCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full font-mono text-xs bg-slate-100 text-slate-500">
        지형 지도 엔진 초기화 중...
      </div>
    ),
  }
);

const SURFACE_OPTIONS: { label: string; value: SurfaceType; albedo: number }[] = [
  { label: "신설 아스팔트 (고열부하, α=0.08)", value: "asphalt_new", albedo: 0.08 },
  { label: "노후 아스팔트 (α=0.15)", value: "asphalt_old", albedo: 0.15 },
  { label: "콘크리트/보도블록 (α=0.25)", value: "concrete", albedo: 0.25 },
  { label: "우레탄 트랙 (관절완충, α=0.10)", value: "urethane", albedo: 0.10 },
  { label: "마사토/흙길 (α=0.20)", value: "dirt", albedo: 0.20 },
  { label: "자연 잔디 (저충격, α=0.25)", value: "grass", albedo: 0.25 },
];

export default function WorkspaceClient() {
  const [nodes, setNodes] = useState<Record<string, CampusNode>>({});
  const [edges, setEdges] = useState<Record<string, CampusEdge>>({});

  const [classCode, setClassCode] = useState<string>("CLASS_2026_A");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  // 사이드바 서브 탭 ('draw' | 'delete')
  const [sidebarTab, setSidebarTab] = useState<"draw" | "delete">("draw");

  const [isDrawMode] = useState<boolean>(true);
  const [autoInterpolate15m, setAutoInterpolate15m] = useState<boolean>(true);
  const [snapState, setSnapState] = useState<SnapResult | null>(null);

  // 💡 찍은 모든 점들을 누적하여 점선으로 쭉 이어지도록 유지
  const [activePoints, setActivePoints] = useState<[number, number][]>([]);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);

  const [selectedSurface, setSelectedSurface] = useState<SurfaceType>("asphalt_new");
  const [isShaded, setIsShaded] = useState<boolean>(false);
  const [showMappingTable, setShowMappingTable] = useState<boolean>(false);

  // 지도 클릭 시 선택된 대상
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // 1. Supabase 실시간 동기화
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const loadInitialData = async () => {
      try {
        const { data: session } = await supabase
          .from("class_sessions")
          .select("is_locked")
          .eq("class_code", classCode)
          .maybeSingle();

        if (session) {
          setIsLocked(Boolean(session.is_locked));
        }

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
            const dist = Number(row.distance ?? row.length_m ?? 0);
            const rawSurface = row.surface_type === "asphalt" ? "asphalt_new" : row.surface_type;
            const surfaceType = (rawSurface || "asphalt_new") as SurfaceType;
            const albedoVal = Number(row.albedo ?? getSurfaceAlbedo(surfaceType));
            const effSolar = Number(row.effective_solar ?? 650.0);
            const absRad = Number(row.r_abs ?? calculateAbsorbedRadiation(effSolar, albedoVal));
            const deltaH = Number(row.target_elevation ?? 30.0) - Number(row.source_elevation ?? 30.0);

            edgeMap[row.id] = {
              id: row.id,
              source: row.source_id,
              target: row.target_id,
              distance: dist,
              slope: Number(row.slope ?? 0.0),
              delta_h: Math.round(deltaH * 10) / 10,
              surface_type: surfaceType,
              albedo: albedoVal,
              is_shaded: Boolean(row.is_shaded),
              effective_solar: effSolar,
              r_abs: absRad,
              team_id: row.team_id || "ALL",
            };
          });
        }

        setNodes(nodeMap);
        setEdges(edgeMap);
      } catch (e) {
        console.error("데이터 로드 중 예외 발생:", e);
      }
    };

    loadInitialData();

    // 노드 웹소켓 구독
    const nodeChannel = supabase
      .channel("realtime:campus_nodes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campus_nodes",
          filter: `class_code=eq.${classCode}`,
        },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setNodes((prev) => {
              const copy = { ...prev };
              delete copy[deletedId];
              return copy;
            });
            setSelectedNodeId((prev) => (prev === deletedId ? null : prev));
            return;
          }

          const row = payload.new as any;
          setNodes((prev) => ({
            ...prev,
            [row.id]: {
              id: row.id,
              lat: Number(row.lat),
              lng: Number(row.lng),
              elevation: Number(row.elevation ?? 30.0),
            },
          }));
        }
      )
      .subscribe();

    // 간선 웹소켓 구독
    const edgeChannel = supabase
      .channel("realtime:campus_edges")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campus_edges",
          filter: `class_code=eq.${classCode}`,
        },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setEdges((prev) => {
              const copy = { ...prev };
              delete copy[deletedId];
              return copy;
            });
            setSelectedEdgeId((prev) => (prev === deletedId ? null : prev));
            return;
          }

          const row = payload.new as any;
          const deltaH = Number(row.target_elevation ?? 30.0) - Number(row.source_elevation ?? 30.0);
          const rawSurface = row.surface_type === "asphalt" ? "asphalt_new" : row.surface_type;
          const surfaceType = (rawSurface || "asphalt_new") as SurfaceType;

          setEdges((prev) => ({
            ...prev,
            [row.id]: {
              id: row.id,
              source: row.source_id,
              target: row.target_id,
              distance: Number(row.distance ?? row.length_m ?? 0),
              slope: Number(row.slope ?? 0.0),
              delta_h: Math.round(deltaH * 10) / 10,
              surface_type: surfaceType,
              albedo: Number(row.albedo ?? 0.15),
              is_shaded: Boolean(row.is_shaded),
              effective_solar: Number(row.effective_solar ?? 650.0),
              r_abs: Number(row.r_abs ?? 500.0),
              team_id: row.team_id || "ALL",
            },
          }));
        }
      )
      .subscribe();

    // 수업 잠금 감지
    const sessionChannel = supabase
      .channel("realtime:class_sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_sessions",
          filter: `class_code=eq.${classCode}`,
        },
        (payload: any) => {
          if (payload.new && "is_locked" in payload.new) {
            setIsLocked(Boolean(payload.new.is_locked));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(nodeChannel);
      supabase.removeChannel(edgeChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [classCode]);

  // 15m 스냅 검사
  const handleMouseMove = useCallback(
    (lat: number, lng: number) => {
      if (!isDrawMode || isLocked || sidebarTab === "delete") {
        setSnapState(null);
        return;
      }
      const existingNodesList = Object.values(nodes);
      setSnapState(snapToExistingNode(lat, lng, existingNodesList));
    },
    [isDrawMode, isLocked, sidebarTab, nodes]
  );

  // 지도 빈 곳 클릭 핸들러 (찍은 점들을 모두 누적해서 점선 연결)
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!isDrawMode || isLocked || sidebarTab === "delete") return;

      const existingNodesList = Object.values(nodes);
      const snapResult = snapToExistingNode(lat, lng, existingNodesList);

      let targetLat = lat;
      let targetLng = lng;
      let targetNodeId: string;
      let targetElevation: number;

      if (snapResult.snapped && snapResult.nodeId) {
        targetLat = snapResult.lat;
        targetLng = snapResult.lng;
        targetNodeId = snapResult.nodeId;
      } else {
        targetNodeId = `N_${Date.now().toString().slice(-5)}`;
        targetElevation = await fetchVworldElevation(targetLat, targetLng);

        const newNode: CampusNode = {
          id: targetNodeId,
          lat: targetLat,
          lng: targetLng,
          elevation: targetElevation,
        };

        setNodes((prev) => ({ ...prev, [targetNodeId]: newNode }));

        if (isSupabaseConfigured()) {
          await supabase.from("campus_nodes").upsert({
            id: targetNodeId,
            class_code: classCode,
            team_id: "ALL",
            lat: targetLat,
            lng: targetLng,
            elevation: targetElevation,
          });
        }
      }

      // 💡 찍은 점들을 자르지 않고 모두 누적 (지도 위 점선 전체 유지)
      setActivePoints((prev) => [...prev, [targetLat, targetLng]]);
      setActiveNodeIds((prev) => [...prev, targetNodeId]);
    },
    [isDrawMode, isLocked, sidebarTab, nodes, classCode]
  );

  // 지도 위 노드 클릭 시
  const handleSelectNodeFromMap = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSidebarTab("delete");
  }, []);

  // 지도 위 간선 클릭 시
  const handleSelectEdgeFromMap = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setSidebarTab("delete");
  }, []);

  // 직전 핀 취소
  const handleUndoPoint = () => {
    if (activePoints.length === 0) return;
    setActivePoints((prev) => prev.slice(0, -1));
    setActiveNodeIds((prev) => prev.slice(0, -1));
  };

  // 작도 라인 리셋
  const handleResetActivePoints = () => {
    if (isLocked) return;
    setActivePoints([]);
    setActiveNodeIds([]);
  };

  // 💡 도로 간선 확정: 현재 점선으로 그어놓은 모든 구간(N개 핀 -> N-1개 간선)을 순서대로 전부 연산 및 확정
  const handleCommitEdge = async () => {
    if (activeNodeIds.length < 2 || isLocked || isCommitting) return;

    setIsCommitting(true);

    try {
      const albedoVal = getSurfaceAlbedo(selectedSurface);
      const baseSolar = 650.0;
      const effSolar = calculateEffectiveSolar(baseSolar, isShaded);
      const absRad = calculateAbsorbedRadiation(effSolar, albedoVal);

      // 현재 점선으로 이어진 모든 구간 순회 (0 -> 1, 1 -> 2, ..., N-2 -> N-1)
      for (let segIdx = 0; segIdx < activeNodeIds.length - 1; segIdx++) {
        const sourceId = activeNodeIds[segIdx];
        const targetId = activeNodeIds[segIdx + 1];

        if (sourceId === targetId) continue;

        const u = nodes[sourceId];
        const v = nodes[targetId];
        if (!u || !v) continue;

        const totalDist = getHaversineDistance(u.lat, u.lng, v.lat, v.lng);

        if (autoInterpolate15m && totalDist > 15.0) {
          const interpolatedPts = interpolatePoints(u.lat, u.lng, v.lat, v.lng, 15.0);
          let prevNode = u;

          for (let i = 0; i < interpolatedPts.length; i++) {
            const pt = interpolatedPts[i];
            const isLast = i === interpolatedPts.length - 1;
            const subNodeId = isLast
              ? targetId
              : `N_${Date.now().toString().slice(-4)}_${segIdx}_${i}`;

            let subNode = isLast ? v : nodes[subNodeId];
            if (!subNode) {
              const elev = await fetchVworldElevation(pt.lat, pt.lng);
              subNode = { id: subNodeId, lat: pt.lat, lng: pt.lng, elevation: elev };
              setNodes((prev) => ({ ...prev, [subNodeId]: subNode }));

              if (isSupabaseConfigured()) {
                await supabase.from("campus_nodes").upsert({
                  id: subNodeId,
                  class_code: classCode,
                  team_id: "ALL",
                  lat: pt.lat,
                  lng: pt.lng,
                  elevation: elev,
                });
              }
            }

            const subDist =
              Math.round(
                getHaversineDistance(prevNode.lat, prevNode.lng, subNode.lat, subNode.lng) * 10
              ) / 10;
            const subSlope = calculateSlopePct(
              prevNode.elevation ?? 30.0,
              subNode.elevation ?? 30.0,
              subDist
            );
            const deltaH =
              Math.round(((subNode.elevation ?? 30.0) - (prevNode.elevation ?? 30.0)) * 10) / 10;
            const subEdgeId = `E_${prevNode.id}_${subNode.id}_${Date.now()
              .toString()
              .slice(-3)}_${segIdx}_${i}`;

            const newSubEdge: CampusEdge = {
              id: subEdgeId,
              source: prevNode.id,
              target: subNode.id,
              distance: subDist,
              slope: subSlope,
              delta_h: deltaH,
              surface_type: selectedSurface,
              albedo: albedoVal,
              is_shaded: isShaded,
              effective_solar: effSolar,
              r_abs: absRad,
              team_id: "ALL",
            };

            setEdges((prev) => ({ ...prev, [subEdgeId]: newSubEdge }));

            if (isSupabaseConfigured()) {
              await supabase.from("campus_edges").insert({
                id: subEdgeId,
                class_code: classCode,
                team_id: "ALL",
                source_id: prevNode.id,
                source_lat: prevNode.lat,
                source_lng: prevNode.lng,
                source_elevation: prevNode.elevation ?? 30.0,
                target_id: subNode.id,
                target_lat: subNode.lat,
                target_lng: subNode.lng,
                target_elevation: subNode.elevation ?? 30.0,
                distance: subDist,
                length_m: subDist,
                slope: subSlope,
                surface_type: selectedSurface,
                albedo: albedoVal,
                is_shaded: isShaded,
                effective_solar: effSolar,
                r_abs: absRad,
              });
            }

            prevNode = subNode;
          }
        } else {
          const distM = Math.round(totalDist * 10) / 10;
          const slopeVal = calculateSlopePct(u.elevation ?? 30.0, v.elevation ?? 30.0, distM);
          const deltaH = Math.round(((v.elevation ?? 30.0) - (u.elevation ?? 30.0)) * 10) / 10;
          const edgeId = `E_${sourceId}_${targetId}_${Date.now().toString().slice(-3)}_${segIdx}`;

          const newEdge: CampusEdge = {
            id: edgeId,
            source: sourceId,
            target: targetId,
            distance: distM,
            slope: slopeVal,
            delta_h: deltaH,
            surface_type: selectedSurface,
            albedo: albedoVal,
            is_shaded: isShaded,
            effective_solar: effSolar,
            r_abs: absRad,
            team_id: "ALL",
          };

          setEdges((prev) => ({ ...prev, [edgeId]: newEdge }));

          if (isSupabaseConfigured()) {
            await supabase.from("campus_edges").insert({
              id: edgeId,
              class_code: classCode,
              team_id: "ALL",
              source_id: sourceId,
              source_lat: u.lat,
              source_lng: u.lng,
              source_elevation: u.elevation ?? 30.0,
              target_id: targetId,
              target_lat: v.lat,
              target_lng: v.lng,
              target_elevation: v.elevation ?? 30.0,
              distance: distM,
              length_m: distM,
              slope: slopeVal,
              surface_type: selectedSurface,
              albedo: albedoVal,
              is_shaded: isShaded,
              effective_solar: effSolar,
              r_abs: absRad,
            });
          }
        }
      }

      // 모든 점선 구간 확정 후, 다음 연속 작도를 위해 맨 마지막 도착 핀만 시작점으로 유지
      const lastNodeId = activeNodeIds[activeNodeIds.length - 1];
      const lastNode = nodes[lastNodeId];
      if (lastNode) {
        setActivePoints([[lastNode.lat, lastNode.lng]]);
        setActiveNodeIds([lastNodeId]);
      } else {
        setActivePoints([]);
        setActiveNodeIds([]);
      }
    } finally {
      setIsCommitting(false);
    }
  };

  // --- [즉각 반응형 실시간 삭제 핸들러] ---

  const handleDeleteNode = async (nodeId: string) => {
    if (isLocked) {
      alert("현재 수업 잠금 상태이므로 삭제할 수 없습니다.");
      return;
    }
    if (!nodeId) return;

    const connectedEdges = Object.values(edges).filter(
      (e) => e.source === nodeId || e.target === nodeId
    );

    const confirmMsg =
      connectedEdges.length > 0
        ? `노드 [${nodeId}]를 삭제하시겠습니까?\n이 노드에 연결된 도로 간선 ${connectedEdges.length}개도 함께 삭제됩니다.`
        : `노드 [${nodeId}]를 삭제하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    setNodes((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });

    setEdges((prev) => {
      const next = { ...prev };
      connectedEdges.forEach((e) => delete next[e.id]);
      return next;
    });

    setActiveNodeIds((prev) => prev.filter((id) => id !== nodeId));
    setSelectedNodeId(null);

    if (isSupabaseConfigured()) {
      supabase.from("campus_nodes").delete().eq("id", nodeId).then();
      if (connectedEdges.length > 0) {
        supabase
          .from("campus_edges")
          .delete()
          .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`)
          .then();
      }
    }
  };

  const handleDeleteEdge = async (edgeId: string) => {
    if (isLocked) {
      alert("현재 수업 잠금 상태이므로 삭제할 수 없습니다.");
      return;
    }
    const targetEdge = edges[edgeId];
    if (!targetEdge) return;

    if (!confirm(`간선 [${edgeId}]를 삭제하시겠습니까?`)) return;

    const uNodeId = targetEdge.source;
    const vNodeId = targetEdge.target;

    const nextEdges = { ...edges };
    delete nextEdges[edgeId];
    const remainingEdgesList = Object.values(nextEdges);

    const isUStillUsed = remainingEdgesList.some(
      (e) => e.source === uNodeId || e.target === uNodeId
    );
    const isVStillUsed = remainingEdgesList.some(
      (e) => e.source === vNodeId || e.target === vNodeId
    );

    const orphanNodesToDelete: string[] = [];
    if (!isUStillUsed) orphanNodesToDelete.push(uNodeId);
    if (!isVStillUsed) orphanNodesToDelete.push(vNodeId);

    setEdges(nextEdges);

    if (orphanNodesToDelete.length > 0) {
      setNodes((prevNodes) => {
        const nextNodes = { ...prevNodes };
        orphanNodesToDelete.forEach((nid) => delete nextNodes[nid]);
        return nextNodes;
      });
      setActiveNodeIds((prev) => prev.filter((id) => !orphanNodesToDelete.includes(id)));
    }

    setSelectedEdgeId(null);

    if (isSupabaseConfigured()) {
      supabase.from("campus_edges").delete().eq("id", edgeId).then();
      if (orphanNodesToDelete.length > 0) {
        supabase.from("campus_nodes").delete().in("id", orphanNodesToDelete).then();
      }
    }
  };

  const handleUndoLastEdge = async () => {
    if (isLocked) return;
    const edgeList = Object.values(edges);
    if (edgeList.length === 0) {
      alert("삭제할 수 있는 간선이 없습니다.");
      return;
    }
    const lastEdge = edgeList[edgeList.length - 1];
    await handleDeleteEdge(lastEdge.id);
  };

  const handleClearAllData = async () => {
    if (isLocked) return;
    const input = prompt(
      `[경고] 학급(${classCode})의 전체 도로망을 초기화합니다.\n진행하시려면 '초기화'를 입력하세요:`
    );
    if (input !== "초기화") return;

    setNodes({});
    setEdges({});
    setActivePoints([]);
    setActiveNodeIds([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);

    if (isSupabaseConfigured()) {
      await supabase.from("campus_edges").delete().eq("class_code", classCode);
      await supabase.from("campus_nodes").delete().eq("class_code", classCode);
    }
  };

  // 2차시 통계 표준 13개 컬럼 준수 + 양방향(순방향/역방향 2행씩) 자동 분할 CSV 추출
  const handleExportFullCampusRoadsCsv = () => {
    const headers = [
      "edge_id",
      "name",
      "source_node",
      "target_node",
      "length_m",
      "surface_type",
      "albedo",
      "solar_rad_w_m2",
      "absorbed_rad_w_m2",
      "elevation_start_m",
      "elevation_end_m",
      "slope_pct",
      "is_shaded",
    ];

    const rows: string[] = [];

    Object.values(edges).forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      const startElev = u?.elevation ?? 30.0;
      const endElev = v?.elevation ?? (startElev + (edge.delta_h ?? 0));
      const solarVal = edge.effective_solar ?? 650.0;
      const rAbsVal = edge.r_abs ?? Math.round(solarVal * (1 - edge.albedo));

      const fwdEdgeId = `${edge.id}_FWD`;
      const fwdName = `${edge.source}➔${edge.target}_${edge.surface_type}_순방향`;
      rows.push(
        [
          fwdEdgeId,
          fwdName,
          edge.source,
          edge.target,
          edge.distance.toFixed(1),
          edge.surface_type,
          edge.albedo.toFixed(2),
          solarVal.toFixed(1),
          rAbsVal.toFixed(1),
          startElev.toFixed(1),
          endElev.toFixed(1),
          edge.slope.toFixed(1),
          edge.is_shaded ? "TRUE" : "FALSE",
        ].join(",")
      );

      const revEdgeId = `${edge.id}_REV`;
      const revName = `${edge.target}➔${edge.source}_${edge.surface_type}_역방향`;
      const revSlope = -edge.slope;
      rows.push(
        [
          revEdgeId,
          revName,
          edge.target,
          edge.source,
          edge.distance.toFixed(1),
          edge.surface_type,
          edge.albedo.toFixed(2),
          solarVal.toFixed(1),
          rAbsVal.toFixed(1),
          endElev.toFixed(1),
          startElev.toFixed(1),
          revSlope.toFixed(1),
          edge.is_shaded ? "TRUE" : "FALSE",
        ].join(",")
      );
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PAPSrun_campus_roads_${classCode}_bidirectional.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedNodeObj = selectedNodeId ? nodes[selectedNodeId] : null;
  const selectedEdgeObj = selectedEdgeId ? edges[selectedEdgeId] : null;

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50">
      <TopNavBar currentPath="/workspace" />

      {isLocked && (
        <div className="bg-amber-500 py-1.5 text-center text-xs font-bold text-white shadow-inner">
          [수업 제어 인터락] 현재 교사에 의해 작도 권한이 잠겨 있습니다. (읽기 전용 동결 모드)
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {/* 지도 영역 */}
        <main className="relative flex-1 h-full">
          <LeafletMapCanvas
            nodes={nodes}
            edges={edges}
            activePoints={activePoints}
            snapState={snapState}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onMapClick={handleMapClick}
            onMouseMove={handleMouseMove}
            onSelectNode={handleSelectNodeFromMap}
            onSelectEdge={handleSelectEdgeFromMap}
          />

          <div className="absolute z-20 flex gap-2 bottom-4 left-4">
            <button
              onClick={() => setShowMappingTable(!showMappingTable)}
              className="rounded-md border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur hover:bg-slate-50"
            >
              {showMappingTable ? "▼ 매핑 표 닫기" : "▲ 1차시 지형·피복 매핑 표 열기"}
            </button>
            <button
              onClick={handleExportFullCampusRoadsCsv}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-sky-700"
            >
              📥 양방향 도로망 표준 CSV 다운로드 ({Object.keys(edges).length * 2}행 추출)
            </button>
          </div>

          {showMappingTable && (
            <div className="absolute z-20 p-3 overflow-auto border rounded-lg shadow-xl bottom-14 left-4 right-4 max-h-56 border-slate-300 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800">
                  [1차시 산출물] 지형 3D 표고 및 피복별 추정 알베도 매핑 현황 ({Object.keys(edges).length}구간, 양방향 {Object.keys(edges).length * 2}코스)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  총 연장: {(Object.values(edges).reduce((acc, cur) => acc + cur.distance, 0) / 1000).toFixed(2)} km
                </span>
              </div>
              <table className="mt-2 w-full text-left font-mono text-[11px] text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="py-1">간선 ID</th>
                    <th>구간(U➔V)</th>
                    <th>거리(m)</th>
                    <th>순방향 경사(U➔V)</th>
                    <th>역방향 경사(V➔U)</th>
                    <th>피복 유형</th>
                    <th>알베도(α)</th>
                    <th>흡수복사(W/m²)</th>
                    <th>차광</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(edges).map((edge) => (
                    <tr key={edge.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-1 font-semibold text-sky-700">{edge.id}</td>
                      <td>{edge.source} ➔ {edge.target}</td>
                      <td>{edge.distance.toFixed(1)}m</td>
                      <td className={edge.slope > 0 ? "text-amber-600 font-bold" : edge.slope < 0 ? "text-blue-600" : ""}>
                        {edge.slope > 0 ? "+" : ""}{edge.slope.toFixed(1)}% ({edge.slope > 0 ? "오르막" : edge.slope < 0 ? "내리막" : "평지"})
                      </td>
                      <td className={-edge.slope > 0 ? "text-amber-600 font-bold" : -edge.slope < 0 ? "text-blue-600" : ""}>
                        {-edge.slope > 0 ? "+" : ""}{(-edge.slope).toFixed(1)}% ({-edge.slope > 0 ? "오르막" : -edge.slope < 0 ? "내리막" : "평지"})
                      </td>
                      <td>{edge.surface_type}</td>
                      <td>{edge.albedo}</td>
                      <td>{Math.round(edge.r_abs ?? 500)}</td>
                      <td>{edge.is_shaded ? "70% 차광" : "직사"}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteEdge(edge.id)}
                          disabled={isLocked}
                          className="text-[10px] text-red-500 hover:underline disabled:text-slate-300"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        {/* 우측 제어 사이드바 */}
        <aside className="z-10 flex flex-col border-l shadow-sm w-96 border-slate-200 bg-white/95 backdrop-blur-sm">
          {/* 탭 헤더 */}
          <div className="flex p-1 border-b border-slate-200 bg-slate-100/70">
            <button
              onClick={() => setSidebarTab("draw")}
              className={`flex-1 rounded py-1.5 text-xs font-bold transition ${
                sidebarTab === "draw"
                  ? "bg-white text-sky-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ✏️ 지형 작도
            </button>
            <button
              onClick={() => setSidebarTab("delete")}
              className={`flex-1 rounded py-1.5 text-xs font-bold transition ${
                sidebarTab === "delete"
                  ? "bg-white text-rose-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🗑️ 삭제 관리 {(selectedNodeId || selectedEdgeId) ? "●" : ""}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {sidebarTab === "draw" ? (
              /* --- [1. 지형 작도 탭] --- */
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="font-mono text-[11px] font-bold text-sky-600">
                    1차시 [지구과학① 본시 실습]
                  </span>
                  <h2 className="text-sm font-bold text-slate-800">
                    지형 3D 입체화 & 도로망 작도
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    브이월드 3D DEM 고도 및 양방향 위상 인터페이스
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">노면 피복 유형 (알베도)</label>
                  <select
                    value={selectedSurface}
                    onChange={(e) => setSelectedSurface(e.target.value as SurfaceType)}
                    disabled={isLocked}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs focus:border-sky-500 focus:outline-none disabled:bg-slate-100"
                  >
                    {SURFACE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="shade-check"
                    checked={isShaded}
                    onChange={(e) => setIsShaded(e.target.checked)}
                    disabled={isLocked}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="shade-check" className="font-medium text-slate-700">
                    수목 그늘 차광 (직달일사 70% 감면)
                  </label>
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-slate-700">15m 자동 분할 보간</span>
                      <span className="text-[10px] text-slate-400">장거리 도로 15m 간격 균일 분할</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoInterpolate15m}
                      onChange={(e) => setAutoInterpolate15m(e.target.checked)}
                      disabled={isLocked}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="rounded-md border border-sky-100 bg-sky-50/60 p-2.5 text-[11px] text-slate-700 space-y-1">
                  <span className="font-bold text-sky-800">유네스코 AI 윤리 제30조 (공간적 포용성)</span>
                  <p className="text-[10px] text-slate-500">
                    급경사 및 완충 보행로 비율을 균형 있게 조사하고 있는지 실시간 점검합니다.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-center font-mono">
                    <div className="p-1 bg-white border rounded border-slate-200">
                      <span className="text-[9px] text-slate-400 block">급경사(8%↑) 간선</span>
                      <span className="font-bold text-amber-600">
                        {Object.values(edges).filter((e) => Math.abs(e.slope) >= 8).length}개
                      </span>
                    </div>
                    <div className="p-1 bg-white border rounded border-slate-200">
                      <span className="text-[9px] text-slate-400 block">완충 피복(잔디/흙)</span>
                      <span className="font-bold text-emerald-600">
                        {Object.values(edges).filter((e) => e.surface_type === "grass" || e.surface_type === "dirt").length}개
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={handleCommitEdge}
                    disabled={activeNodeIds.length < 2 || isLocked || isCommitting}
                    className="w-full py-2 font-semibold text-white transition rounded bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300"
                  >
                    {isCommitting
                      ? "작도 구간 연산 중..."
                      : `도로 간선 확정 (${Math.max(0, activeNodeIds.length - 1)}개 구간 DEM/경사 산출)`}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleUndoPoint}
                      disabled={activePoints.length === 0 || isLocked}
                      className="rounded border border-slate-200 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      직전 핀 취소 (Undo)
                    </button>
                    <button
                      onClick={handleResetActivePoints}
                      disabled={isLocked}
                      className="rounded border border-slate-200 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100"
                    >
                      작도 라인 리셋
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* --- [2. 삭제 관리 탭] --- */
              <div className="space-y-4 text-xs">
                <div>
                  <span className="font-mono text-[11px] font-bold text-rose-600">
                    지형·위상 무결성 관리
                  </span>
                  <h2 className="text-sm font-bold text-slate-800">
                    노드 및 간선 통합 삭제 콘솔
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    지도 위 핀이나 도로를 클릭하면 상세 제원 확인과 즉시 삭제가 가능합니다.
                  </p>
                </div>

                {selectedNodeObj && (
                  <div className="p-3 space-y-2 border-2 rounded-lg shadow-sm border-sky-400 bg-sky-50/80 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-900">📍 지도에서 선택된 교차점</span>
                      <button
                        onClick={() => setSelectedNodeId(null)}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >
                        ✕ 닫기
                      </button>
                    </div>
                    <div className="bg-white rounded p-2 text-[11px] font-mono space-y-1 border border-sky-100 text-slate-700">
                      <div><strong>ID:</strong> {selectedNodeObj.id}</div>
                      <div><strong>해발 표고:</strong> <span className="font-bold text-sky-600">{selectedNodeObj.elevation ?? 30.0}m</span></div>
                      <div><strong>좌표:</strong> {selectedNodeObj.lat.toFixed(5)}, {selectedNodeObj.lng.toFixed(5)}</div>
                      <div className="text-[10px] text-slate-400">
                        연결된 도로: {Object.values(edges).filter(e => e.source === selectedNodeObj.id || e.target === selectedNodeObj.id).length}개
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNode(selectedNodeObj.id)}
                      disabled={isLocked}
                      className="w-full rounded bg-rose-600 py-1.5 font-bold text-white transition hover:bg-rose-700 disabled:bg-slate-300"
                    >
                      🗑️ 이 노드 삭제 (연결 도로 동시 정리)
                    </button>
                  </div>
                )}

                {selectedEdgeObj && (
                  <div className="p-3 space-y-2 border-2 rounded-lg shadow-sm border-rose-400 bg-rose-50/80 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900">🛣️ 지도에서 선택된 양방향 도로</span>
                      <button
                        onClick={() => setSelectedEdgeId(null)}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >
                        ✕ 닫기
                      </button>
                    </div>
                    <div className="bg-white rounded p-2 text-[11px] font-mono space-y-1.5 border border-rose-100 text-slate-700">
                      <div><strong>간선 ID:</strong> {selectedEdgeObj.id} (양방향 유효)</div>
                      <div><strong>구간 연결:</strong> {selectedEdgeObj.source} ⟷ {selectedEdgeObj.target} ({selectedEdgeObj.distance.toFixed(1)}m)</div>
                      <div className="rounded bg-slate-50 p-1.5 border border-slate-200 space-y-0.5">
                        <div className="text-sky-700">
                          • <strong>순방향({selectedEdgeObj.source}➔{selectedEdgeObj.target}):</strong>{" "}
                          <span className="font-bold">{selectedEdgeObj.slope > 0 ? "+" : ""}{selectedEdgeObj.slope.toFixed(1)}%</span>{" "}
                          ({selectedEdgeObj.slope > 0 ? "오르막" : selectedEdgeObj.slope < 0 ? "내리막" : "평지"})
                        </div>
                        <div className="text-indigo-700">
                          • <strong>역방향({selectedEdgeObj.target}➔{selectedEdgeObj.source}):</strong>{" "}
                          <span className="font-bold">{-selectedEdgeObj.slope > 0 ? "+" : ""}{(-selectedEdgeObj.slope).toFixed(1)}%</span>{" "}
                          ({-selectedEdgeObj.slope > 0 ? "오르막" : -selectedEdgeObj.slope < 0 ? "내리막" : "평지"})
                        </div>
                      </div>
                      <div><strong>피복/알베도:</strong> {selectedEdgeObj.surface_type} (α={selectedEdgeObj.albedo})</div>
                      <div><strong>흡수복사에너지:</strong> <span className="font-bold text-rose-600">{Math.round(selectedEdgeObj.r_abs ?? 500)} W/m²</span> {selectedEdgeObj.is_shaded ? "(차광)" : "(직사)"}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteEdge(selectedEdgeObj.id)}
                      disabled={isLocked}
                      className="w-full rounded bg-rose-600 py-1.5 font-bold text-white transition hover:bg-rose-700 disabled:bg-slate-300"
                    >
                      🗑️ 이 도로 삭제 (고립 노드 동시 정리)
                    </button>
                  </div>
                )}

                <div className="p-3 space-y-2 border rounded-lg border-slate-200 bg-slate-50/70">
                  <span className="block font-bold text-slate-700">목록에서 도로(Edge) 선택</span>
                  <select
                    value={selectedEdgeId || ""}
                    onChange={(e) => {
                      setSelectedEdgeId(e.target.value || null);
                      setSelectedNodeId(null);
                    }}
                    disabled={isLocked}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-rose-500 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">도로를 선택하세요 ({Object.keys(edges).length}건)</option>
                    {Object.values(edges).map((edge) => (
                      <option key={edge.id} value={edge.id}>
                        [{edge.id}] {edge.source}⟷{edge.target} ({edge.distance.toFixed(1)}m, {edge.slope > 0 ? "+" : ""}{edge.slope.toFixed(1)}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 space-y-2 border rounded-lg border-slate-200 bg-slate-50/70">
                  <span className="block font-bold text-slate-700">목록에서 핀(Node) 선택</span>
                  <select
                    value={selectedNodeId || ""}
                    onChange={(e) => {
                      setSelectedNodeId(e.target.value || null);
                      setSelectedEdgeId(null);
                    }}
                    disabled={isLocked}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-rose-500 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">핀을 선택하세요 ({Object.keys(nodes).length}건)</option>
                    {Object.values(nodes).map((node) => (
                      <option key={node.id} value={node.id}>
                        [{node.id}] 고도: {node.elevation ?? 30.0}m ({node.lat.toFixed(4)}, {node.lng.toFixed(4)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 space-y-2 border rounded-lg border-amber-200 bg-amber-50/50">
                  <span className="block font-bold text-amber-800">⚡ 빠른 되돌리기 및 초기화</span>
                  <button
                    onClick={handleUndoLastEdge}
                    disabled={Object.keys(edges).length === 0 || isLocked}
                    className="w-full rounded border border-amber-300 bg-white py-1.5 font-medium text-amber-900 transition hover:bg-amber-100 disabled:border-slate-200 disabled:text-slate-400"
                  >
                    ↺ 마지막 도로 1개 되돌리기
                  </button>
                  <button
                    onClick={handleClearAllData}
                    disabled={isLocked || (Object.keys(nodes).length === 0 && Object.keys(edges).length === 0)}
                    className="w-full rounded border border-rose-300 bg-rose-50 py-1.5 font-bold text-rose-700 transition hover:bg-rose-100 disabled:border-slate-200 disabled:text-slate-400"
                  >
                    ⚠️ 학급 전체 데이터 초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}