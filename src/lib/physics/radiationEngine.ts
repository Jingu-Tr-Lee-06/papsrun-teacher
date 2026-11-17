/**
 * 가로수 그늘 차광률(70% 감면)을 반영한 유효 일사량 연산 (W/m²)
 * @param solarRadiation 기상청 측정 직달 일사량 (W/m²)
 * @param isShaded 수목 그늘 차광 여부
 * @returns 차광 보정된 유효 일사량 (W/m²)
 */
export function calculateEffectiveSolar(
  solarRadiation: number,
  isShaded: boolean = false
): number {
  const safeSolar = Math.max(0.0, Number(solarRadiation) || 0.0);
  const transmittance = isShaded ? 0.30 : 1.0; // 그늘 시 투과율 30% (70% 차광 감면)
  return Math.round(safeSolar * transmittance * 100) / 100;
}

/**
 * 지표면 순흡수 복사에너지 연산: R_abs = S * (1 - albedo)
 * @param effectiveSolar 유효 일사량 (W/m²)
 * @param albedo 노면 반사율 (0.0 ~ 1.0)
 * @returns 순흡수 복사에너지 (W/m²)
 */
export function calculateAbsorbedRadiation(
  effectiveSolar: number,
  albedo: number
): number {
  const safeSolar = Math.max(0.0, Number(effectiveSolar) || 0.0);
  const safeAlbedo = Math.max(0.0, Math.min(1.0, Number(albedo) || 0.15));
  const rAbs = safeSolar * (1.0 - safeAlbedo);
  return Math.round(rAbs * 100) / 100;
}