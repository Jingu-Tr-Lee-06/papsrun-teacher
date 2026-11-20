from typing import Union


def compute_edge_slope(
    elev_u: Union[int, float],
    elev_v: Union[int, float],
    length_m: Union[int, float],
) -> float:
    try:
        dist = float(length_m if length_m is not None else 0.0)
    except (ValueError, TypeError):
        return 0.0

    if dist <= 0.1:
        return 0.0

    try:
        u_alt = float(elev_u if elev_u is not None else 0.0)
    except (ValueError, TypeError):
        u_alt = 0.0

    try:
        v_alt = float(elev_v if elev_v is not None else 0.0)
    except (ValueError, TypeError):
        v_alt = 0.0

    slope_pct = ((v_alt - u_alt) / dist) * 100.0
    return round(slope_pct, 2)