from typing import Dict

SURFACE_ALBEDO_MAP: Dict[str, float] = {
    "asphalt": 0.10,
    "asphalt_new": 0.08,
    "asphalt_old": 0.14,
    "urethane": 0.15,
    "urethane_track": 0.15,
    "dirt": 0.22,
    "dirt_trail": 0.22,
    "grass": 0.25,
    "concrete": 0.30,
    "concrete_walkway": 0.30,
}


def get_surface_albedo(surface_type: str) -> float:
    key = (surface_type or "asphalt").strip().lower()
    return SURFACE_ALBEDO_MAP.get(key, 0.15)