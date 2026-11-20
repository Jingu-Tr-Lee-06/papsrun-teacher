from typing import Union


def predict_ml_bpm_gain(
    slope_pct: Union[int, float],
    absorbed_radiation: Union[int, float],
    weight_kg: Union[int, float],
    paps_strain_factor: Union[int, float] = 1.0,
) -> float:
    try:
        slope = float(slope_pct if slope_pct is not None else 0.0)
    except (ValueError, TypeError):
        slope = 0.0

    try:
        r_abs = max(0.0, float(absorbed_radiation if absorbed_radiation is not None else 350.0))
    except (ValueError, TypeError):
        r_abs = 350.0

    try:
        weight = max(30.0, float(weight_kg if weight_kg is not None else 65.0))
    except (ValueError, TypeError):
        weight = 65.0

    try:
        strain = max(0.5, float(paps_strain_factor if paps_strain_factor is not None else 1.0))
    except (ValueError, TypeError):
        strain = 1.0

    effective_slope = max(-3.0, slope)
    intercept = 8.5
    beta_slope = 2.85 * effective_slope
    beta_rad = 0.018 * r_abs
    beta_weight = 0.16 * (weight - 60.0)

    raw_gain = (intercept + beta_slope + beta_rad + beta_weight) * strain
    return round(max(0.0, raw_gain), 2)