import { CampusNode } from "../../types/road";
import { getHaversineDistance } from "./haversine";

// 자석 스냅 임계 반경 (m)
const SNAP_THRESHOLD_METERS = 15.0;

export interface SnapResult {
  snapped: boolean;
  lat: number;
  lng: number;
  nodeId?: string;
  distance?: number;
}

/**
 * 15m 반경 내 가장 가까운 노드로 좌표 흡착
 * @param lat 마우스 클릭 위도
 * @param lng 마우스 클릭 경도
 * @param existingNodes 현재 등록된 노드 배열
 * @returns 스냅 여부 및 보정된 좌표 정보
 */
export function snapToExistingNode(
  lat: number,
  lng: number,
  existingNodes: CampusNode[]
): SnapResult {
  let closestNode: CampusNode | null = null;
  let minDistance = Infinity;

  for (const node of existingNodes) {
    const dist = getHaversineDistance(lat, lng, node.lat, node.lng);
    if (dist <= SNAP_THRESHOLD_METERS && dist < minDistance) {
      minDistance = dist;
      closestNode = node;
    }
  }

  if (closestNode) {
    return {
      snapped: true,
      lat: closestNode.lat,
      lng: closestNode.lng,
      nodeId: closestNode.id,
      distance: minDistance,
    };
  }

  return {
    snapped: false,
    lat,
    lng,
  };
}