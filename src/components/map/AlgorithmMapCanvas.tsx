"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CampusNode, CampusEdge } from "@/types/road";
import { DijkstraStep } from "@/lib/algorithms/dijkstraStepEngine";

interface AlgorithmMapCanvasProps {
  nodes: Record<string, CampusNode>;
  edges: Record<string, CampusEdge>;
  startNodeId: string;
  targetNodeId: string;
  currentStep: DijkstraStep | null;
  shortestPath: string[];
  onNodeSelect: (nodeId: string) => void;
}

export default function AlgorithmMapCanvas({
  nodes,
  edges,
  startNodeId,
  targetNodeId,
  currentStep,
  shortestPath,
  onNodeSelect,
}: AlgorithmMapCanvasProps) {
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
    if (!layerGroupRef.current || !currentStep) return;
    layerGroupRef.current.clearLayers();

    const visitedSet = new Set(currentStep.visitedNodes);
    const activeEdgeId = currentStep.evaluatedEdgeId;
    const isFinalStep = shortestPath.length > 0 && currentStep.currentNodeId === targetNodeId;

    // 1. 간선(도로망) 렌더링
    Object.values(edges).forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      if (!u || !v) return;

      const isRelaxingEdge = activeEdgeId === edge.id;
      // 최종 경로에 포함된 간선인지 검사
      let isShortestEdge = false;
      if (isFinalStep) {
        for (let i = 0; i < shortestPath.length - 1; i++) {
          if (
            (shortestPath[i] === edge.source && shortestPath[i + 1] === edge.target) ||
            (shortestPath[i] === edge.target && shortestPath[i + 1] === edge.source)
          ) {
            isShortestEdge = true;
            break;
          }
        }
      }

      let color = "#cbd5e1"; // 미방문 기본 도로 (연회색)
      let weight = 4;
      let opacity = 0.6;

      if (isShortestEdge) {
        color = "#2563eb"; // 최종 최단 경로 (선명한 파란색)
        weight = 8;
        opacity = 1;
      } else if (isRelaxingEdge) {
        color = "#f97316"; // 완화 중인 도로 (주황색)
        weight = 7;
        opacity = 1;
      } else if (visitedSet.has(edge.source) && visitedSet.has(edge.target)) {
        color = "#0284c7"; // 방문 완료된 도로 (하늘색)
        weight = 5;
        opacity = 0.8;
      }

      L.polyline([[u.lat, u.lng], [v.lat, v.lng]], {
        color,
        weight,
        opacity,
      })
        .bindTooltip(`도로 [${edge.id}]: ${edge.distance.toFixed(1)}m`)
        .addTo(layerGroupRef.current!);
    });

    // 2. 노드(교차점) 렌더링
    Object.values(nodes).forEach((node) => {
      const isStart = node.id === startNodeId;
      const isTarget = node.id === targetNodeId;
      const isCurrent = node.id === currentStep.currentNodeId;
      const isVisited = visitedSet.has(node.id);
      const currentDist = currentStep.distances[node.id];

      let fillColor = "#94a3b8"; // 미방문
      let radius = 6;

      if (isStart) {
        fillColor = "#10b981"; // 시작 노드 (에메랄드)
        radius = 9;
      } else if (isTarget) {
        fillColor = "#ef4444"; // 도착 노드 (빨강)
        radius = 9;
      } else if (isCurrent) {
        fillColor = "#f59e0b"; // 현재 탐색 중인 노드 (노랑/주황)
        radius = 8;
      } else if (isVisited) {
        fillColor = "#0284c7"; // 방문 완료 노드 (하늘색)
        radius = 7;
      }

      const distText = currentDist === Infinity ? "∞" : `${currentDist.toFixed(1)}m`;

      const marker = L.circleMarker([node.lat, node.lng], {
        radius,
        fillColor,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      });

      marker.bindTooltip(
        `<div style="font-family: sans-serif; font-size: 11px;">
          <strong>노드 [${node.id}]</strong><br/>
          누적 최단거리: <strong>${distText}</strong><br/>
          상태: ${isCurrent ? "🔍 현재 노드" : isVisited ? "✅ 방문 확정" : "⏳ 대기 중"}
        </div>`
      );

      marker.on("click", () => {
        onNodeSelect(node.id);
      });

      marker.addTo(layerGroupRef.current!);
    });
  }, [nodes, edges, startNodeId, targetNodeId, currentStep, shortestPath, onNodeSelect]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}