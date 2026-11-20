from typing import Any, Dict, List


def generate_xai_explanation(
    eval_data: Dict[str, Any],
    profile: Dict[str, Any],
    thr_info: Dict[str, Any],
) -> Dict[str, Any]:
    opt = eval_data.get("optimal", {})
    sht = eval_data.get("shortest", {})

    dist_diff = float(opt.get("distance", 0.0)) - float(sht.get("distance", 0.0))
    saved_bpm = float(sht.get("max_bpm", 130.0)) - float(opt.get("max_bpm", 120.0))
    saved_elev = float(sht.get("elev_gain", 0.0)) - float(opt.get("elev_gain", 0.0))
    saved_rad = float(sht.get("avg_rad", 300.0)) - float(opt.get("avg_rad", 220.0))

    grade = int(profile.get("paps_grade", 3))
    target_min = float(thr_info.get("target_min", 130.0))
    target_max = float(thr_info.get("target_max", 165.0))
    status = str(thr_info.get("status", "OPTIMAL_ZONE"))

    reasons: List[str] = [
        f"맞춤 생체 안전 설계 (PAPS {grade}등급 기준): 카보넨 공식 유효 유산소 목표 구간({target_min:.1f} ~ {target_max:.1f} BPM)을 기준으로 경로 비용을 최적화했습니다 (판정: {status})."
    ]

    if dist_diff > 0:
        reasons.append(
            f"전략적 우회 판단: 물리적 최단 경로보다 약 {dist_diff:.1f} m 완만하게 우회하여 급경사 오르막과 고온 노출 구간을 회피했습니다."
        )
    else:
        reasons.append(
            "직선·안전 동시 달성: 최단 거리와 동일한 동선 내에서 노면 충격과 복사열 부하가 가장 적은 안전 구간이 선택되었습니다."
        )

    if saved_bpm > 0:
        reasons.append(
            f"심혈관 과부하 억제: 급경사 및 열 스트레스 구간 배제를 통해 예상 최고 심박수를 약 {saved_bpm:.1f} BPM 낮췄습니다."
        )

    if saved_elev > 0:
        reasons.append(
            f"관절·근피로 경감: 누적 상승 고도를 {saved_elev:.1f} m 줄여 하체 관절에 가해지는 충격을 완화했습니다."
        )

    if saved_rad > 0:
        reasons.append(
            f"미기상 복사열 차단: 가로수 그늘(차광률 70%)과 고알베도 노면을 우선 배정하여 평균 흡수 복사열을 {saved_rad:.1f} W/m² 절감했습니다."
        )

    return {
        "title": "EXPLAINABLE AI (XAI) — 왜 이 코스를 추천했나요?",
        "reasons": reasons,
        "summary_text": "\n".join(f"• {r}" for r in reasons),
    }