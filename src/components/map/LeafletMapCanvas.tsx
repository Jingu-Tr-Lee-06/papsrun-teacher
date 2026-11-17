"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CampusNode, CampusEdge, SurfaceType } from "@/types/road";
import { SnapResult } from "@/lib/gis/snapEngine";

interface LeafletMapCanvasProps {
  nodes: Record<string, CampusNode>;
  edges: Record<string, CampusEdge>;
  activePoints: [number, number][];
  snapState: SnapResult | null;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onMapClick: (lat: number, lng: number) => void;
  onMouseMove: (lat: number, lng: number) => void;
  onSelectEdge?: (edgeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}

const SURFACE_COLORS: Record<SurfaceType, string> = {
  asphalt_new: "#1e293b",
  asphalt_old: "#475569",
  concrete: "#94a3b8",
  urethane: "#e11d48",
  dirt: "#d97706",
  grass: "#16a34a",
};

export default function LeafletMapCanvas({
  nodes,
  edges,
  activePoints,
  snapState,
  selectedNodeId,
  selectedEdgeId,
  onMapClick,
  onMouseMove,
  onSelectEdge,
  onSelectNode,
}: LeafletMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const edgeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const nodeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const tempDrawLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // 💡 최신 콜백 함수를 Ref에 보관하여 지도 인스턴스 재생성 방지
  const onMapClickRef = useRef(onMapClick);
  const onMouseMoveRef = useRef(onMouseMove);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onMouseMoveRef.current = onMouseMove;
  }, [onMouseMove]);

  // 💡 지도 인스턴스는 최초 마운트 시 딱 1번만 생성 (확대/이동 위치 절대 안 풀림)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [36.4675, 127.1405],
      zoom: 17,
      zoomControl: true,
      zoomAnimation: false,      // 💡 _leaflet_pos 런타임 에러 원천 차단
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    edgeLayerGroupRef.current = L.layerGroup().addTo(map);
    nodeLayerGroupRef.current = L.layerGroup().addTo(map);
    tempDrawLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    });

    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      onMouseMoveRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;

    return () => {
      try {
        map.stop();   // 진행 중인 줌/이동 애니메이션 강제 정지
        map.off();    // 이벤트 리스너 일괄 해제
        map.remove(); // 인스턴스 안전 정리
      } catch (e) {
        console.warn("Leaflet cleanup skipped:", e);
      }
      mapInstanceRef.current = null;
    };
  }, []); // 👈 빈 의존성 배열로 고정

  // 1. 간선(도로망) 렌더링 (양방향 정보 툴팁 강화)
  useEffect(() => {
    if (!edgeLayerGroupRef.current) return;
    edgeLayerGroupRef.current.clearLayers();

    Object.values(edges).forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      if (!u || !v) return;

      const isSelected = selectedEdgeId === edge.id;
      const baseColor = SURFACE_COLORS[edge.surface_type] || "#3b82f6";
      const lineColor = isSelected ? "#f43f5e" : baseColor;
      const lineWeight = isSelected ? 9 : 6;

      const polyline = L.polyline(
        [
          [u.lat, u.lng],
          [v.lat, v.lng],
        ],
        {
          color: lineColor,
          weight: lineWeight,
          opacity: isSelected ? 1.0 : 0.85,
          dashArray: edge.is_shaded ? "8, 6" : undefined,
        }
      );

      const fwdSlope = edge.slope;
      const revSlope = -edge.slope;
      const fwdSymbol = fwdSlope > 0 ? "🔺 오르막" : fwdSlope < 0 ? "🔻 내리막" : "➖ 평지";
      const revSymbol = revSlope > 0 ? "🔺 오르막" : revSlope < 0 ? "🔻 내리막" : "➖ 평지";

      polyline.bindTooltip(
        `<div style="font-family: sans-serif; font-size: 11px; line-height: 1.45;">
          <strong>[${edge.id}] 양방향 보행로</strong> ${isSelected ? "<b style='color:#f43f5e;'>(선택됨)</b>" : ""}<br/>
          • 실거리: <strong>${edge.distance.toFixed(1)}m</strong> | 피복: ${edge.surface_type} (α=${edge.albedo})<br/>
          • 순방향 (${edge.source} ➔ ${edge.target}): <strong>${fwdSlope > 0 ? "+" : ""}${fwdSlope.toFixed(1)}%</strong> (${fwdSymbol})<br/>
          • 역방향 (${edge.target} ➔ ${edge.source}): <strong>${revSlope > 0 ? "+" : ""}${revSlope.toFixed(1)}%</strong> (${revSymbol})<br/>
          • 흡수복사: ${Math.round(edge.r_abs ?? 500)} W/m² ${edge.is_shaded ? "(차광)" : "(직사)"}<br/>
          <span style="color: #0284c7; font-size: 10px;">👉 클릭하여 사이드바에서 상세 확인 및 삭제</span>
        </div>`,
        { sticky: true }
      );

      polyline.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectEdge) onSelectEdge(edge.id);
      });

      polyline.addTo(edgeLayerGroupRef.current!);
    });
  }, [edges, nodes, selectedEdgeId, onSelectEdge]);

  // 2. 노드(핀) 렌더링
  useEffect(() => {
    if (!nodeLayerGroupRef.current) return;
    nodeLayerGroupRef.current.clearLayers();

    Object.values(nodes).forEach((node) => {
      const isSelected = selectedNodeId === node.id;

      const marker = L.circleMarker([node.lat, node.lng], {
        radius: isSelected ? 9 : 6,
        fillColor: isSelected ? "#f43f5e" : "#0284c7",
        color: isSelected ? "#fde047" : "#ffffff",
        weight: isSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.95,
      });

      marker.bindTooltip(
        `<div style="font-family: sans-serif; font-size: 11px; line-height: 1.4;">
          <strong>📍 ${node.id}</strong> ${isSelected ? "<b style='color:#f43f5e;'>(선택됨)</b>" : ""}<br/>
          • 고도: <strong>${node.elevation ?? 30.0}m</strong> (3D DEM)<br/>
          • 위경도: ${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}<br/>
          <span style="color: #0284c7; font-size: 10px;">👉 클릭하여 사이드바에서 상세 확인 및 삭제</span>
        </div>`,
        { sticky: true }
      );

      marker.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectNode) onSelectNode(node.id);
      });

      marker.addTo(nodeLayerGroupRef.current!);
    });
  }, [nodes, selectedNodeId, onSelectNode]);

  // 3. 임시 작도 포인트 렌더링
  useEffect(() => {
    if (!tempDrawLayerGroupRef.current) return;
    tempDrawLayerGroupRef.current.clearLayers();

    if (activePoints.length > 0) {
      if (activePoints.length >= 2) {
        L.polyline(activePoints, {
          color: "#0ea5e9",
          weight: 4,
          dashArray: "6, 6",
          opacity: 0.9,
        }).addTo(tempDrawLayerGroupRef.current!);
      }

      activePoints.forEach(([lat, lng], idx) => {
        L.circleMarker([lat, lng], {
          radius: 7,
          fillColor: idx === activePoints.length - 1 ? "#10b981" : "#f59e0b",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 1,
        })
          .bindTooltip(`작도 포인트 #${idx + 1}`, { permanent: false })
          .addTo(tempDrawLayerGroupRef.current!);
      });
    }

    if (snapState && snapState.snapped) {
      L.circleMarker([snapState.lat, snapState.lng], {
        radius: 12,
        fillColor: "#38bdf8",
        color: "#0284c7",
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.3,
      }).addTo(tempDrawLayerGroupRef.current!);
    }
  }, [activePoints, snapState]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}