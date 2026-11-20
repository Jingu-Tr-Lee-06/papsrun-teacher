from typing import Dict, Union


def evaluate_target_hr_zone(
    predicted_bpm: Union[int, float],
    rest_hr: Union[int, float] = 70.0,
    age: int = 17,
    paps_grade: int = 3,
) -> Dict[str, Union[float, str, bool]]:
    try:
        pred = float(predicted_bpm if predicted_bpm is not None else 130.0)
    except (ValueError, TypeError):
        pred = 130.0

    try:
        r_hr = max(45.0, min(110.0, float(rest_hr if rest_hr is not None else 70.0)))
    except (ValueError, TypeError):
        r_hr = 70.0

    try:
        user_age = max(12, min(80, int(age if age is not None else 17)))
    except (ValueError, TypeError):
        user_age = 17

    try:
        grade = max(1, min(5, int(paps_grade if paps_grade is not None else 3)))
    except (ValueError, TypeError):
        grade = 3

    max_hr = 220.0 - user_age
    hrr = max(40.0, max_hr - r_hr)

    if grade >= 4:
        low_pct, high_pct = 0.50, 0.70
    elif grade == 3:
        low_pct, high_pct = 0.55, 0.75
    else:
        low_pct, high_pct = 0.60, 0.80

    target_min = round(r_hr + hrr * low_pct, 1)
    target_max = round(r_hr + hrr * high_pct, 1)

    if pred > target_max:
        status = "OVER_EXERTION"
        message = f"예상 심박수({pred:.1f} BPM)가 안전 상한({target_max:.1f} BPM)을 초과합니다."
        is_safe = False
    elif pred < target_min:
        status = "UNDER_STIMULUS"
        message = f"예상 심박수({pred:.1f} BPM)가 목표 구간 하한({target_min:.1f} BPM) 미만입니다."
        is_safe = True
    else:
        status = "OPTIMAL_ZONE"
        message = f"유효 유산소 목표 구간({target_min:.1f}~{target_max:.1f} BPM) 내 안전 주행입니다."
        is_safe = True

    return {
        "target_min": target_min,
        "target_max": target_max,
        "status": status,
        "is_safe": is_safe,
        "message": message,
    }