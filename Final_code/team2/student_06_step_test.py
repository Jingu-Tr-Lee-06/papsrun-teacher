from typing import Union


def calculate_base_delta_hr(
    peak_hr: Union[int, float],
    rest_hr: Union[int, float],
) -> float:
    try:
        p_hr = float(peak_hr if peak_hr is not None else 135.0)
    except (ValueError, TypeError):
        p_hr = 135.0

    try:
        r_hr = float(rest_hr if rest_hr is not None else 70.0)
    except (ValueError, TypeError):
        r_hr = 70.0

    diff = p_hr - r_hr
    return max(0.0, round(diff, 1))