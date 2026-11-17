# [학생 06번] 3분 스텝검사 기초 심박 상승치 산출 모듈
def calculate_base_delta_hr(paps_grade: int) -> float:
    step_delta_map = {1: 18.0, 2: 24.0, 3: 30.0, 4: 38.0, 5: 46.0}
    return float(step_delta_map.get(paps_grade, 30.0))
