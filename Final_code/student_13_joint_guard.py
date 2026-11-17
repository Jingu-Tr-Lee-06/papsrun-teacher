# [학생 13번] 노면 충격량 관절 보호 페널티 계수 모듈
def get_surface_joint_penalty(surface_type: str, paps_grade: int) -> float:
    hardness = {
        "urethane": 0.7, "grass": 0.8, "dirt": 0.9,
        "asphalt_old": 1.2, "concrete": 1.3, "asphalt_new": 1.4
    }.get(surface_type, 1.0)
    grade_factor = 1.3 if paps_grade >= 4 else 1.0
    return round(hardness * grade_factor, 3)
