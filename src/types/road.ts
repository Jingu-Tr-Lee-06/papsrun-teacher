// 1차시 지구과학 표준 노면 6종 피복 체계
export type SurfaceType =
  | "asphalt_new"   // 신설 아스팔트 (α = 0.08)
  | "asphalt_old"   // 노후 아스팔트 (α = 0.15)
  | "concrete"      // 콘크리트/보도블록 (α = 0.25)
  | "urethane"      // 우레탄 트랙 (α = 0.10)
  | "dirt"          // 마사토/흙길 (α = 0.20)
  | "grass";        // 자연 잔디 (α = 0.25)

export interface CampusNode {
  id: string;
  lat: number;
  lng: number;
  elevation: number; // 표고 (고도 m)
  team_id?: string;
  is_accessible_ramp?: boolean; // 이동약자 경사로 여부 (포용성)
}

export interface CampusEdge {
  id: string;
  source: string;
  target: string;
  distance: number;          // 수평 대원거리 (m)
  slope: number;             // 경사도 (%) = (Δh / distance) * 100
  delta_h?: number;          // 구간 표고차 (m)
  surface_type: SurfaceType; // 노면 피복 6종
  albedo: number;            // 노면 고유 반사율 (α)
  is_shaded: boolean;        // 수목 차광 여부 (직달일사 70% 감쇄)
  effective_solar: number;   // 도달 유효 일사량 (W/m²)
  r_abs: number;             // 지표 순흡수 복사에너지 (W/m²)
  team_id: string;           // 1~4조 분담 권역
}