from typing import Union


def calculate_absorbed_radiation(
    effective_solar: Union[int, float],
    albedo: Union[int, float],
) -> float:
    try:
        solar = max(0.0, float(effective_solar if effective_solar is not None else 500.0))
    except (ValueError, TypeError):
        solar = 500.0

    try:
        alpha = max(0.0, min(1.0, float(albedo if albedo is not None else 0.15)))
    except (ValueError, TypeError):
        alpha = 0.15

    r_abs = solar * (1.0 - alpha)
    return round(r_abs, 2)