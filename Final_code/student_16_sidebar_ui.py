# [학생 16번] 사용자 설정 및 동일 출발/도착 방어 인터락 모듈
def validate_route_selection(start_node: str, end_node: str) -> dict:
    if not start_node or not end_node:
        return {"valid": False, "message": "출발 노드와 도착 노드를 모두 선택해야 합니다."}
    if start_node == end_node:
        return {"valid": False, "message": "출발 노드와 도착 노드가 동일합니다. 다른 노드를 지정하세요."}
    return {"valid": True, "message": "경로 탐색 준비 완료"}
