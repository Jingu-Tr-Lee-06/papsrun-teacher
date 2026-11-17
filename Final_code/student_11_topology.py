# [학생 11번] 캠퍼스 도로망 그래프 무결성 및 고립 노드 검증 모듈
def validate_campus_graph(num_nodes: int, num_components: int, isolated_count: int) -> dict:
    is_valid = (num_components == 1) and (isolated_count == 0)
    penalty = (num_components - 1) * 25 + isolated_count * 15
    score = max(0, 100 - penalty)
    return {
        "is_routable": is_valid,
        "topology_score": score,
        "isolated_nodes": isolated_count
    }
