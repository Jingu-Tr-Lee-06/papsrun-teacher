# [학생 12번] 이종 데이터 Min-Max 0~1 선형 정규화 모듈
def min_max_normalize(val: float, val_min: float, val_max: float) -> float:
    if val_max <= val_min:
        return 0.0
    clamped = max(val_min, min(val, val_max))
    normalized = (clamped - val_min) / (val_max - val_min)
    return round(normalized, 4)
