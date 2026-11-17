import { getHaversineDistance } from "./haversine";

export interface InterpolatedPoint {
  lat: number;
  lng: number;
}

/**
 * 시점과 종점 사이에 stepM(기본 15m) 간격으로 중간 좌표를 선형 보간하여 분할 생성
 */
export function interpolatePoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  stepM: number = 15.0
): InterpolatedPoint[] {
  const totalDist = getHaversineDistance(startLat, startLng, endLat, endLng);
  
  // 거리가 15m 이하인 경우 중간 분할 없이 종점만 반환
  if (totalDist <= stepM) {
    return [{ lat: endLat, lng: endLng }];
  }

  const numSegments = Math.ceil(totalDist / stepM);
  const result: InterpolatedPoint[] = [];

  for (let i = 1; i <= numSegments; i++) {
    const fraction = i / numSegments;
    const lat = startLat + (endLat - startLat) * fraction;
    const lng = startLng + (endLng - startLng) * fraction;
    result.push({
      lat: Math.round(lat * 1000000) / 1000000,
      lng: Math.round(lng * 1000000) / 1000000,
    });
  }

  return result;
}