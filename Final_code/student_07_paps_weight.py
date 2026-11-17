# [학생 07번] PAPS 등급 및 체중별 운동 부하 계수 모듈
def get_paps_strain_factor(paps_grade: int, body_weight_kg: float = 60.0) -> float:
    base_factor = {1: 0.85, 2: 1.0, 3: 1.15, 4: 1.35, 5: 1.6}.get(paps_grade, 1.0)
    weight_ratio = body_weight_kg / 60.0
    return round(base_factor * weight_ratio, 3)
