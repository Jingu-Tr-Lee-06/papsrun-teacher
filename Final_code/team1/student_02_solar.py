from typing import Union


def calculate_effective_solar(
    solar_w: Union[int, float],
    is_shaded: bool = False,
) -> float:
    try:
        raw_solar = float(solar_w if solar_w is not None else 700.0)
    except (ValueError, TypeError):
        raw_solar = 700.0

    safe_solar = max(0.0, raw_solar)
    transmittance = 0.30 if bool(is_shaded) else 1.0
    return round(safe_solar * transmittance, 2)
