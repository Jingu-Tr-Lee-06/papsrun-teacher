# [학생 09번] 최대 심박수 한계선(220 BPM) 보호 클램핑 모듈
def clamp_physiological_bpm(current_bpm: float, max_limit: float = 220.0) -> float:
    clamped = max(40.0, min(float(current_bpm), float(max_limit)))
    return round(clamped, 1)
