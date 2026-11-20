from typing import Union


def min_max_normalize(
    val: Union[int, float],
    min_val: Union[int, float],
    max_val: Union[int, float],
) -> float:
    try:
        v = float(val if val is not None else 0.0)
        lo = float(min_val if min_val is not None else 0.0)
        hi = float(max_val if max_val is not None else 1.0)
    except (ValueError, TypeError):
        return 0.5

    if hi <= lo:
        return 0.5

    norm = (v - lo) / (hi - lo)
    clamped = max(0.0, min(1.0, norm))
    return round(clamped, 4)