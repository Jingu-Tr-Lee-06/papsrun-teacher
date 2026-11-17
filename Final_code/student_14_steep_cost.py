# [학생 14번] 급경사(>5%) 비선형 페널티 모듈
def calculate_slope_strain_penalty(slope_pct: float, paps_grade: int) -> float:
    if slope_pct <= 0:
        return 0.0
    if slope_pct > 5.0 and paps_grade >= 4:
        return round(((slope_pct - 5.0) ** 2) * 0.5, 3)
    return round(slope_pct * 0.2, 3)
