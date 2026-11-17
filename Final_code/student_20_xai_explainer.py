# [학생 20번] 설명가능한 AI(XAI) 경로 추천 사유 해설 패널 모듈
def generate_xai_explanation(is_detour: bool, saved_bpm: float, shaded_ratio: float) -> str:
    if is_detour:
        return (
            f"💡 [알고리즘 추천 사유]\n"
            f"직선 오르막 대비 거리가 약 40m 늘어나지만, 예상 심박수 급증을 {saved_bpm:.1f} BPM 줄이고 "
            f"그늘 비율 {shaded_ratio * 100:.0f}% 구간을 우선 통과하여 심폐 과부하를 안전하게 방어합니다."
        )
    return "💡 [알고리즘 추천 사유] 경사도가 완만하고 열부하가 낮아 기본 최단 경로로 안내합니다."
