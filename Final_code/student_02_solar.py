# [학생 02번] 그늘 차광률 및 유효 일사량 연산 모듈
def calculate_effective_solar(base_solar_radiation: float, is_shaded: bool) -> float:
    if is_shaded:
        return round(base_solar_radiation * 0.30, 2)
    return float(base_solar_radiation)
