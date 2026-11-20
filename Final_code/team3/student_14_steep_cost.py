from typing import Union


def calculate_steep_slope_multiplier(
    slope_pct: Union[int, float],
    paps_grade: int = 3,
) -> float:
    try:
        slope = float(slope_pct if slope_pct is not None else 0.0)
    except (ValueError, TypeError):
        slope = 0.0

    try:
        grade = max(1, min(5, int(paps_grade if paps_grade is not None else 3)))
    except (ValueError, TypeError):
        grade = 3

    if slope <= 2.0:
        return 1.0

    if grade >= 4:
        if slope > 5.0:
            excess = slope - 5.0
            multiplier = 1.6 + (excess ** 2) * 0.25
        else:
            multiplier = 1.0 + (slope - 2.0) * 0.20
    elif grade == 3:
        if slope > 6.0:
            multiplier = 1.4 + (slope - 6.0) * 0.25
        else:
            multiplier = 1.0 + (slope - 2.0) * 0.10
    else:
        if slope > 8.0:
            multiplier = 1.2 + (slope - 8.0) * 0.15
        else:
            multiplier = 1.0 + (slope - 2.0) * 0.05

    return round(min(15.0, multiplier), 3)