# [학생 15번] 다익스트라 최적화 코어 음수 비용 방어(max 0.1) 래퍼 모듈
def compute_final_dijkstra_edge_cost(base_cost: float, min_floor: float = 0.1) -> float:
    return max(float(min_floor), round(float(base_cost), 4))
