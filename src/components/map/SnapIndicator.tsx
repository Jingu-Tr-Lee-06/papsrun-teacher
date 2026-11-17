"use client";

import React from "react";
import { Circle, CircleMarker, Tooltip } from "react-leaflet";
import { SnapResult } from "../../lib/gis/snapEngine";

interface SnapIndicatorProps {
  snapState: SnapResult | null;
}

/**
 * 15m 자석 스냅 감지 및 좌표 흡착 상태 시각화 오버레이
 */
export default function SnapIndicator({ snapState }: SnapIndicatorProps) {
  if (!snapState) return null;

  const { snapped, lat, lng, nodeId, distance } = snapState;

  // 자석 스냅 성공 시: 스카이 블루 강조 링 및 타겟 마커
  if (snapped) {
    return (
      <>
        {/* 15m 유효 흡착 반경 가이드 링 */}
        <Circle
          center={[lat, lng]}
          radius={15}
          pathOptions={{
            color: "#0284c7",       // sky-600
            fillColor: "#bae6fd",   // sky-200
            fillOpacity: 0.25,
            weight: 1.5,
            dashArray: "4, 4",
          }}
        />

        {/* 흡착된 중심 노드 앵커 핀 */}
        <CircleMarker
          center={[lat, lng]}
          radius={6}
          pathOptions={{
            color: "#0369a1",       // sky-700
            fillColor: "#0ea5e9",   // sky-500
            fillOpacity: 1.0,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95} permanent>
            <span className="font-mono text-xs font-semibold text-slate-800">
              스냅 고정: {nodeId} ({distance ? distance.toFixed(1) : "0.0"}m)
            </span>
          </Tooltip>
        </CircleMarker>
      </>
    );
  }

  // 단순 마우스 위치 탐색 링 (스냅 미감지 상태)
  return (
    <Circle
      center={[lat, lng]}
      radius={15}
      pathOptions={{
        color: "#94a3b8",         // slate-400
        fillColor: "#f1f5f9",     // slate-100
        fillOpacity: 0.15,
        weight: 1,
        dashArray: "2, 4",
      }}
    />
  );
}