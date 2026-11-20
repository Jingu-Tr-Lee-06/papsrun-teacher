from typing import Any, Dict, Optional


def build_metrics_comparison_table(
    shortest_stats: Dict[str, Any],
    optimal_stats: Dict[str, Any],
    comfort_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """최단 경로 vs 일반 쾌적 경로 vs PAPSrun 맞춤 경로 3방향 정량 비교표를 생성합니다."""
    s_dist = float(shortest_stats.get("distance", 0.0))
    c_dist = float((comfort_stats or shortest_stats).get("distance", s_dist))
    o_dist = float(optimal_stats.get("distance", 0.0))

    s_elev = float(shortest_stats.get("elev_gain", 0.0))
    c_elev = float((comfort_stats or shortest_stats).get("elev_gain", s_elev))
    o_elev = float(optimal_stats.get("elev_gain", 0.0))

    s_bpm = float(shortest_stats.get("max_bpm", 0.0))
    c_bpm = float((comfort_stats or shortest_stats).get("max_bpm", s_bpm))
    o_bpm = float(optimal_stats.get("max_bpm", 0.0))

    s_rad = float(shortest_stats.get("avg_rad", 0.0))
    c_rad = float((comfort_stats or shortest_stats).get("avg_rad", s_rad))
    o_rad = float(optimal_stats.get("avg_rad", 0.0))

    rows = [
        {
            "metric": "총 이동 거리",
            "unit": "m",
            "shortest": round(s_dist, 1),
            "comfort": round(c_dist, 1),
            "optimal": round(o_dist, 1),
            "delta": round(o_dist - s_dist, 1),
            "delta_label": f"{o_dist - s_dist:+.1f} m",
        },
        {
            "metric": "누적 상승 고도",
            "unit": "m",
            "shortest": round(s_elev, 1),
            "comfort": round(c_elev, 1),
            "optimal": round(o_elev, 1),
            "delta": round(o_elev - s_elev, 1),
            "delta_label": f"{o_elev - s_elev:+.1f} m",
        },
        {
            "metric": "예상 최대 심박수",
            "unit": "BPM",
            "shortest": round(s_bpm, 1),
            "comfort": round(c_bpm, 1),
            "optimal": round(o_bpm, 1),
            "delta": round(o_bpm - s_bpm, 1),
            "delta_label": f"{o_bpm - s_bpm:+.1f} BPM",
        },
        {
            "metric": "평균 흡수 복사열",
            "unit": "W/m²",
            "shortest": round(s_rad, 1),
            "comfort": round(c_rad, 1),
            "optimal": round(o_rad, 1),
            "delta": round(o_rad - s_rad, 1),
            "delta_label": f"{o_rad - s_rad:+.1f} W/m²",
        },
    ]

    return {
        "rows": rows,
        "summary": {
            "dist_diff_m": round(o_dist - s_dist, 1),
            "elev_diff_m": round(o_elev - s_elev, 1),
            "bpm_saved": round(s_bpm - o_bpm, 1),
            "rad_saved_wm2": round(s_rad - o_rad, 1),
        },
    }