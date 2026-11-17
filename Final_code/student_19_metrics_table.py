# [학생 19번] 거리·고도·심박 3단 비교 카드 데이터 구성 모듈
def build_comparison_metrics(distance_m: float, delta_h_m: float, avg_bpm: float) -> dict:
    return {
        "total_distance_km": round(distance_m / 1000.0, 2),
        "elevation_gain_m": round(delta_h_m, 1),
        "predicted_avg_bpm": round(avg_bpm, 1),
        "is_safe_for_paps_4_5": avg_bpm <= 165.0
    }
