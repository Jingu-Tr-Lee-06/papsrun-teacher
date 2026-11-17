import { SurfaceType } from "../../types/road";

// 1차시 지구과학 교육과정 표준 알베도 테이블
export const SURFACE_ALBEDO_MAP: Record<SurfaceType, number> = {
  asphalt_new: 0.08,
  asphalt_old: 0.15,
  urethane: 0.10,
  dirt: 0.20,
  concrete: 0.25,
  grass: 0.25,
};

export function getSurfaceAlbedo(surfaceType: SurfaceType): number {
  return SURFACE_ALBEDO_MAP[surfaceType] ?? 0.15;
}