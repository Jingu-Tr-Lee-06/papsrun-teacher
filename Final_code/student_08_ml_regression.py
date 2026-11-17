# [학생 08번] 머신러닝 다중회귀 OLS 기반 심박 상승치 추론 모듈
def predict_ml_bpm_gain(distance_m: float, slope_pct: float, r_abs: float) -> float:
    bpm_gain = (0.015 * distance_m) + (1.85 * max(0.0, slope_pct)) + (0.02 * (r_abs / 100.0))
    return round(bpm_gain, 2)
