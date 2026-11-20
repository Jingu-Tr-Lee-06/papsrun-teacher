from typing import Union

MAX_PHYSIOLOGICAL_BPM: float = 220.0
MIN_PHYSIOLOGICAL_BPM: float = 55.0


def clamp_physiological_bpm(
    predicted_bpm: Union[int, float],
    rest_hr: Union[int, float] = 65.0,
) -> float:
    try:
        bpm = float(predicted_bpm if predicted_bpm is not None else 110.0)
    except (ValueError, TypeError):
        bpm = 110.0

    try:
        lower_bound = max(MIN_PHYSIOLOGICAL_BPM, float(rest_hr if rest_hr is not None else 65.0))
    except (ValueError, TypeError):
        lower_bound = MIN_PHYSIOLOGICAL_BPM

    clamped = max(lower_bound, min(MAX_PHYSIOLOGICAL_BPM, bpm))
    return round(clamped, 1)