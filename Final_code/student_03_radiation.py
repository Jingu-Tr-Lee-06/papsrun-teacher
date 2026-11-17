# [학생 03번] 지표면 순흡수 복사에너지(R_abs) 연산 모듈
def calculate_absorbed_radiation(effective_solar: float, albedo: float) -> float:
    r_abs = effective_solar * (1.0 - albedo)
    return round(r_abs, 2)
