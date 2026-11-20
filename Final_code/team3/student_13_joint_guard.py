from typing import Dict, Optional

SURFACE_JOINT_WEIGHTS: Dict[str, float] = {
    "urethane": 0.75,
    "urethane_track": 0.75,
    "grass": 0.80,
    "dirt": 0.85,
    "dirt_trail": 0.85,
    "asphalt": 1.15,
    "asphalt_new": 1.15,
    "asphalt_old": 1.20,
    "concrete": 1.30,
    "concrete_walkway": 1.30,
}


def get_surface_joint_penalty(
    surface_type: Optional[str],
    paps_grade: int = 3,
) -> float:
    if not surface_type or not isinstance(surface_type, str):
        base_penalty = 1.00
    else:
        base_penalty = SURFACE_JOINT_WEIGHTS.get(surface_type.strip().lower(), 1.00)

    try:
        grade = max(1, min(5, int(paps_grade)))
    except (ValueError, TypeError):
        grade = 3

    if grade >= 4 and base_penalty > 1.0:
        return round(base_penalty * 1.15, 3)

    return round(base_penalty, 3)