"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CampusNode, CampusEdge } from "@/types/road";
import { TopologyReport } from "@/lib/gis/topologyEngine";

interface TopologyMapCanvasProps {
  nodes: Record<string, CampusNode>;
  edges: Record<string, CampusEdge>;
  report: TopologyReport | null;
}

const COMPONENT_COLORS = [
  "#0284c7", // 하늘색 (주요 구역)
  "#e11d48", // 붉은색 (분리 구역 2)
  "#d97706", // 황토색 (분리 구역 3)
  "#7c3aed", // 보라색 (분리 구역 4)
  "#059669", // 녹색 (분리 구역 5)
];

export default function TopologyMapCanvas({
  nodes,
  edges,
  report,
}: TopologyMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [36.4675, 127.1405],
      zoom: 17,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!layerGroupRef.current || !report) return;
    layerGroupRef.current.clearLayers();

    const isolatedSet = new Set(report.isolatedNodeIds);
    const deadEndSet = new Set(report.deadEndNodeIds);

    // 컴포넌트별 색상 맵 매핑
    const nodeComponentMap: Record<string, number> = {};
    report.components.forEach((comp, idx) => {
      comp.nodeIds.forEach((nid) => {
        nodeComponentMap[nid] = idx;
      });
    });

    // 1. 간선(도로) 렌더링 - 컴포넌트가 다르면 다른 색상 적용
    Object.values(edges).forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      if (!u || !v) return;

      const compIdx = nodeComponentMap[edge.source] ?? 0;
      const lineColor = COMPONENT_COLORS[compIdx % COMPONENT_COLORS.length];

      L.polyline([[u.lat, u.lng], [v.lat, v.lng]], {
        color: lineColor,
        weight: 6,
        opacity: 0.85,
      })
        .bindTooltip(`도로 [${edge.id}]<br/>컴포넌트 그룹 #${compIdx + 1}`)
        .addTo(layerGroupRef.current!);
    });

    // 2. 노드(핀) 렌더링 - 고립 노드와 데드엔드 강조
    Object.values(nodes).forEach((node) => {
      const isIsolated = isolatedSet.has(node.id);
      const isDeadEnd = deadEndSet.has(node.id);

      let fillColor = "#0284c7";
      let radius = 6;
      let label = `정상 연결 노드: ${node.id}`;

      if (isIsolated) {
        fillColor = "#ef4444"; // 고립 노드: 빨간색
        radius = 9;
        label = `⚠️ [결함: 고립 노드] ${node.id} (연결 도로 0개)`;
      } else if (isDeadEnd) {
        fillColor = "#f59e0b"; // 데드엔드: 주황색
        radius = 8;
        label = `⚠️ [결함: 막다른 길] ${node.id} (외길/순환 불가)`;
      }

      L.circleMarker([node.lat, node.lng], {
        radius,
        fillColor,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      })
        .bindTooltip(label)
        .addTo(layerGroupRef.current!);
    });
  }, [nodes, edges, report]);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}