# [학생 18번] 추천 경로 다색 렌더링 스타일링 모듈
def get_path_render_style(path_type: str) -> dict:
    styles = {
        "shortest": {"color": "#ef4444", "weight": 4, "dashArray": "5, 5", "label": "최단거리 코스"},
        "cooling": {"color": "#0ea5e9", "weight": 6, "dashArray": None, "label": "쿨링(그늘) 코스"},
        "joint_care": {"color": "#10b981", "weight": 6, "dashArray": None, "label": "PAPS 맞춤 안심 코스"}
    }
    return styles.get(path_type, {"color": "#6366f1", "weight": 5, "dashArray": None, "label": "추천 코스"})
