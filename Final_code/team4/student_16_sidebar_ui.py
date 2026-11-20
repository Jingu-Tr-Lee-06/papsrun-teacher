from typing import Any, Dict, List, Tuple


def validate_route_selection(
    start_node: str,
    end_node: str,
    available_nodes: List[str],
    profile: Dict[str, Any] = None,
) -> Tuple[bool, str, Dict[str, Any]]:
    if not available_nodes:
        return False, "선택 가능한 캠퍼스 교차점 노드가 없습니다.", {}

    s_node = (start_node or "").strip()
    e_node = (end_node or "").strip()

    if s_node not in available_nodes or e_node not in available_nodes:
        return False, "출발지 또는 도착지 노드가 현재 캠퍼스 도로망에 존재하지 않습니다.", {}

    if s_node == e_node:
        return False, "출발지와 도착지 교차점은 서로 달라야 합니다. 다른 지점을 선택하세요.", {}

    raw_prof = profile or {}
    clean_profile = {
        "paps_grade": max(1, min(5, int(raw_prof.get("paps_grade", 3)))),
        "weight": max(30.0, min(150.0, float(raw_prof.get("weight", 62.0)))),
        "age": max(12, min(80, int(raw_prof.get("age", 17)))),
        "rest_hr": max(40.0, min(110.0, float(raw_prof.get("rest_hr", 70.0)))),
        "peak_hr": max(80.0, min(210.0, float(raw_prof.get("peak_hr", 145.0)))),
    }

    return True, "출발·도착지 및 러너 생체 프로필 검증 완료", clean_profile