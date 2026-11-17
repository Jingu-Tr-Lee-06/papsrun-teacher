import { CampusEdge } from "@/types/road";

export interface NormalizedEdgeMetrics {
  edgeId: string;
  source: string;
  target: string;
  distance: number;
  slope: number;
  r_abs: number;
  // 0 ~ 1 정규화 값
  distNorm: number;
  slopeNorm: number;
  rAbsNorm: number;
  // 다기준 가중합 종합 비용
  totalCost: number;
}

export interface WeightFactors {
  wDist: number;   // 거리 가중치 (기본 0.4)
  wSlope: number;  // 경사도 가중치 (기본 0.3)
  wSolar: number;  // 일사/열부하 가중치 (기본 0.3)
}

export interface NormalizationSummary {
  distRange: { min: number; max: number };
  slopeRange: { min: number; max: number };
  rAbsRange: { min: number; max: number };
  items: NormalizedEdgeMetrics[];
}

/**
 * Min-Max 스케일링 공식:
 * X_norm = (X - X_min) / (X_max - X_min)
 * 분모가 0인 경우(모든 구간 수치가 동일) 0.5 반환
 */
function minMaxScale(val: number, min: number, max: number): number {
  if (max === min) return 0.5;
  const scaled = (val - min) / (max - min);
  return Math.max(0, Math.min(1, Math.round(scaled * 1000) / 1000));
}

/**
 * 간선 데이터 배열을 받아 3대 지표 Min-Max 정규화 및 가중합 비용 산출
 */
export function calculateNormalizedMetrics(
  edges: CampusEdge[],
  weights: WeightFactors = { wDist: 0.4, wSlope: 0.3, wSolar: 0.3 }
): NormalizationSummary {
  if (edges.length === 0) {
    return {
      distRange: { min: 0, max: 0 },
      slopeRange: { min: 0, max: 0 },
      rAbsRange: { min: 0, max: 0 },
      items: [],
    };
  }

  // 1. 최소/최대 극값 탐색
  const distVals = edges.map((e) => e.distance);
  // 경사는 러너 관절/심폐 부하 관점에서 양수 오르막 및 급경사 절대치 부하 고려
  const slopeVals = edges.map((e) => Math.max(0, e.slope)); 
  const rAbsVals = edges.map((e) => e.r_abs ?? 500.0);

  const distMin = Math.min(...distVals);
  const distMax = Math.max(...distVals);

  const slopeMin = Math.min(...slopeVals);
  const slopeMax = Math.max(...slopeVals);

  const rAbsMin = Math.min(...rAbsVals);
  const rAbsMax = Math.max(...rAbsVals);

  // 2. 각 간선별 Min-Max 정규화 및 가중합 Cost 계산
  const items: NormalizedEdgeMetrics[] = edges.map((edge) => {
    const dNorm = minMaxScale(edge.distance, distMin, distMax);
    const sNorm = minMaxScale(Math.max(0, edge.slope), slopeMin, slopeMax);
    const rNorm = minMaxScale(edge.r_abs ?? 500.0, rAbsMin, rAbsMax);

    // Cost = w1 * L_norm + w2 * S_norm + w3 * R_norm
    const cost =
      weights.wDist * dNorm +
      weights.wSlope * sNorm +
      weights.wSolar * rNorm;

    return {
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      distance: edge.distance,
      slope: edge.slope,
      r_abs: edge.r_abs ?? 500.0,
      distNorm: dNorm,
      slopeNorm: sNorm,
      rAbsNorm: rNorm,
      totalCost: Math.round(cost * 1000) / 1000,
    };
  });

  return {
    distRange: { min: distMin, max: distMax },
    slopeRange: { min: slopeMin, max: slopeMax },
    rAbsRange: { min: rAbsMin, max: rAbsMax },
    items,
  };
}