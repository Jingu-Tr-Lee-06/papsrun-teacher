# [학생 04번] DEM 고도차 기반 경사도(%) 계산 모듈
def compute_edge_slope(delta_h_meters: float, distance_meters: float) -> float:
    if distance_meters <= 0:
        return 0.0
    slope_pct = (delta_h_meters / distance_meters) * 100.0
    return round(slope_pct, 2)
