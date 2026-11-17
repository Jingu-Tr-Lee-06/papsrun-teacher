# [학생 05번] 33°C 폭염 야외 주행 강제 차단 안전 인터락 모듈
def check_weather_failsafe(temperature_celsius: float) -> bool:
    if temperature_celsius >= 33.0:
        return False  # 주행 강제 차단 (Fail-Safe 작동)
    return True
