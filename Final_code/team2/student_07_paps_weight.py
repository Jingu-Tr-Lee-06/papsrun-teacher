from typing import Dict, Union

PAPS_STRAIN_MAP: Dict[int, float] = {
    1: 0.80,
    2: 0.90,
    3: 1.00,
    4: 1.25,
    5: 1.50,
}


def get_paps_strain_factor(
    paps_grade: Union[int, float],
    weight_kg: Union[int, float] = 65.0,
) -> float:
    try:
        grade = max(1, min(5, int(paps_grade)))
    except (ValueError, TypeError):
        grade = 3

    base_factor = PAPS_STRAIN_MAP.get(grade, 1.00)

    try:
        w = max(30.0, min(150.0, float(weight_kg if weight_kg is not None else 65.0)))
    except (ValueError, TypeError):
        w = 65.0

    weight_ratio = w / 65.0
    combined_factor = base_factor * (0.7 + 0.3 * weight_ratio)
    return round(combined_factor, 3)