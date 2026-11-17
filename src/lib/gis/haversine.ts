const EARTH_RADIUS_METERS = 6371000; // 지구 평균 반경 (m)

/**
 * 하버사인 공식을 이용한 두 위경도 좌표 간 직선 거리(m) 계산
 * @param lat1 지점 1 위도
 * @param lon1 지점 1 경도
 * @param lat2 지점 2 위도
 * @param lon2 지점 2 경도
 * @returns 두 지점 사이의 거리 (m)
 */
export function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadian = (degree: number) => (degree * Math.PI) / 180.0;

  const dLat = toRadian(lat2 - lat1);
  const dLon = toRadian(lon2 - lon1);

  const radLat1 = toRadian(lat1);
  const radLat2 = toRadian(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METERS * c;

  return Math.round(distance * 10) / 10;
}