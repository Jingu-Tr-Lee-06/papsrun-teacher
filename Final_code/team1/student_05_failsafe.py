from typing import Tuple, Union

HEAT_LIMIT_CELSIUS: float = 33.0
CAUTION_LIMIT_CELSIUS: float = 30.0


def check_weather_failsafe(
    current_temp: Union[int, float],
) -> Tuple[bool, str]:
    try:
        temp = float(current_temp if current_temp is not None else 25.0)
    except (ValueError, TypeError):
        temp = 25.0

    if temp >= HEAT_LIMIT_CELSIUS:
        return (
            False,
            f"[폭염 위험 경보] 현재 기온 {temp:.1f}°C로 안전 기준선({HEAT_LIMIT_CELSIUS:.1f}°C)을 초과했습니다. "
            "열사병 및 온열질환 예방을 위해 실외 달리기 세션이 강제 차단되었습니다. 실내 보강 운동으로 전환하세요.",
        )

    if temp >= CAUTION_LIMIT_CELSIUS:
        return (
            True,
            f"[고온 주의] 현재 기온 {temp:.1f}°C입니다. 충분한 수분 섭취와 그늘 구간 위주 주행을 권장합니다.",
        )

    return (
        True,
        f"[기상 안전 정상] 현재 기온 {temp:.1f}°C로 야외 러닝에 적합한 조건입니다.",
    )