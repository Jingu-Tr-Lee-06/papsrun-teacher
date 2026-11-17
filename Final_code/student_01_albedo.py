# [학생 01번] 노면 알베도(반사율) 매핑 모듈
def get_surface_albedo(surface_type: str) -> float:
    albedo_table = {
        "asphalt_new": 0.05,
        "asphalt_old": 0.15,
        "concrete": 0.25,
        "dirt": 0.20,
        "grass": 0.25,
        "urethane": 0.12
    }
    return albedo_table.get(surface_type, 0.15)
