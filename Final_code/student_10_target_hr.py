# [학생 10번] 카보넨(Karvonen) 공식 유효 유산소 심박수(THR) 평가 모듈
def evaluate_target_hr_zone(current_bpm: float, resting_hr: float = 65.0, age: int = 15) -> str:
    hr_max = 220.0 - age
    hr_reserve = hr_max - resting_hr
    target_low = resting_hr + (hr_reserve * 0.60)
    target_high = resting_hr + (hr_reserve * 0.80)

    if current_bpm < target_low:
        return "LOW_INTENSITY (준비 운동 구간)"
    elif current_bpm <= target_high:
        return "AEROBIC_TARGET_ZONE (최적 유산소 구간)"
    else:
        return "HIGH_STRAIN_ALERT (심혈관 과부하 경고)"
