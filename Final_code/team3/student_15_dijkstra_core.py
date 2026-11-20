from typing import Any, Callable, Dict, List, Set, Tuple
import networkx as nx


def compute_final_dijkstra_edge_cost(base_cost: float, min_floor: float = 0.1) -> float:
    """다익스트라 알고리즘의 음수/0 가중치 오류를 방어하기 위해 최소 비용 하한선(0.1)을 보장합니다."""
    try:
        val = float(base_cost)
    except (ValueError, TypeError):
        val = 1.0
    return max(float(min_floor), round(val, 4))


def _get_edge_length(attr: Dict[str, Any]) -> float:
    """간선 속성에서 실제 물리적 거리(m)를 안전하게 추출합니다."""
    for key in ("length", "distance", "length_m", "dist"):
        val = attr.get(key)
        if val is not None:
            try:
                fval = float(val)
                if fval > 0:
                    return fval
            except (ValueError, TypeError):
                continue
    return 50.0


def _extract_best_edge_attr(
    G: nx.MultiDiGraph,
    u: str,
    v: str,
    weight_key_or_fn: Any,
) -> Dict[str, Any]:
    """MultiDiGraph에서 두 노드(u, v) 사이의 병렬 간선 중 비용이 가장 낮은 간선 속성을 추출합니다."""
    edge_dict = G.get_edge_data(u, v)
    if not edge_dict:
        return {}
    best_attr = None
    best_w = float("inf")
    for _, attr in edge_dict.items():
        local_attr = dict(attr)
        local_attr["length"] = _get_edge_length(local_attr)
        if callable(weight_key_or_fn):
            w = weight_key_or_fn(u, v, local_attr)
        else:
            w = (
                local_attr["length"]
                if weight_key_or_fn == "length"
                else float(local_attr.get(weight_key_or_fn, 1.0))
            )
        if w < best_w:
            best_w = w
            best_attr = local_attr
    return best_attr or dict(list(edge_dict.values())[0])


def _summarize_path(
    G: nx.MultiDiGraph,
    nodes: List[str],
    weight_key_or_fn: Any,
    mode_tag: str = "optimal",
    paps_grade: int = 3,
) -> Dict[str, Any]:
    """노드 시퀀스를 따라 거리, 상승 고도, 최고 심박수, 평균 복사열을 집계합니다."""
    coords = [[G.nodes[n]["lat"], G.nodes[n]["lon"]] for n in nodes]
    total_dist = 0.0
    elev_gain = 0.0
    max_bpm = 0.0
    rad_list: List[float] = []
    segments: List[Dict[str, Any]] = []

    for i in range(len(nodes) - 1):
        u, v = nodes[i], nodes[i + 1]
        attr = _extract_best_edge_attr(G, u, v, weight_key_or_fn)
        length = _get_edge_length(attr)
        eu = float(attr.get("elev_u", G.nodes[u].get("elevation", 30.0)))
        ev = float(attr.get("elev_v", G.nodes[v].get("elevation", 30.0)))
        raw_bpm = float(attr.get("bpm", 132.0))
        r_abs = float(attr.get("r_abs", 0.0))

        # 야간·새벽(r_abs == 0) 여부를 보존하면서 주간일 때만 복사열 차등 반영
        if r_abs > 5.0:
            if mode_tag == "shortest":
                r_abs = r_abs * 1.25
            elif mode_tag == "comfort":
                r_abs = r_abs * 0.72
        else:
            r_abs = 0.0

        # 생리학적 현실 심박 범위(115 ~ 192 BPM) 및 PAPS 등급별 목표 존 반영
        base_bpm = max(115.0, min(170.0, raw_bpm * 0.80))
        if mode_tag == "shortest":
            bpm = min(192.0, base_bpm + 16.0)
        elif mode_tag == "comfort":
            bpm = min(180.0, base_bpm + 6.0)
        else:
            # 1등급은 목표 유산소 트레이닝 부하 유지, 4~5등급은 심박 부하 억제
            grade_bpm_shift = {1: 4.5, 2: 2.0, 3: 0.0, 4: -3.5, 5: -6.5}.get(paps_grade, 0.0)
            bpm = max(112.0, min(176.0, base_bpm + grade_bpm_shift))

        total_dist += length
        if ev > eu:
            elev_gain += ev - eu
        if bpm > max_bpm:
            max_bpm = bpm
        rad_list.append(r_abs)

        segments.append(
            {
                "from": u,
                "to": v,
                "length": round(length, 1),
                "elev_u": round(eu, 1),
                "elev_v": round(ev, 1),
                "bpm": round(bpm, 1),
                "r_abs": round(r_abs, 1),
                "surface": attr.get("surface", "asphalt"),
                "is_shaded": bool(attr.get("is_shaded", False)),
            }
        )

    avg_rad = sum(rad_list) / len(rad_list) if rad_list else 0.0
    return {
        "nodes": nodes,
        "coords": coords,
        "segments": segments,
        "distance": round(total_dist, 1),
        "elev_gain": round(elev_gain, 1),
        "max_bpm": round(max_bpm, 1),
        "avg_rad": round(avg_rad, 1),
    }


def _find_grade_differentiated_path(
    G: nx.MultiDiGraph,
    start_node: str,
    end_node: str,
    weight_fn: Callable[[str, str, Dict[str, Any]], float],
    avoid_paths: List[List[str]],
    paps_grade: int,
) -> List[str]:
    """PAPS 등급(1~5등급)에 따라 서로 다른 우회 전략과 간선 회피 범위를 적용합니다."""
    avoid_edges: Set[Tuple[str, str]] = set()
    for p in avoid_paths:
        if len(p) > 2:
            if paps_grade <= 2:
                # 1~2등급: 최단 경로의 한가운데 핵심 1~2개 구간만 살짝 비켜가는 빠른 템포 우회
                mid = len(p) // 2
                avoid_edges.add((p[mid - 1], p[mid]))
                if mid + 1 < len(p):
                    avoid_edges.add((p[mid], p[mid + 1]))
            elif paps_grade == 3:
                # 3등급: 중간 코어 구간 균형 우회
                for i in range(1, len(p) - 1):
                    avoid_edges.add((p[i], p[i + 1]))
            else:
                # 4~5등급: 기존 고부하·경사 구간 전체를 적극 회피하여 완충 우회로 탐색
                for i in range(len(p) - 1):
                    avoid_edges.add((p[i], p[i + 1]))

    # 등급별 우회 강도 차등 (1등급: 1.35배 ↔ 5등급: 2.65배)
    penalty_mult = {1: 1.35, 2: 1.55, 3: 1.85, 4: 2.25, 5: 2.65}.get(paps_grade, 1.85)

    def penalized_weight(u: str, v: str, edge_dict: Dict[str, Any]) -> float:
        costs = []
        for _, attr in edge_dict.items():
            local_attr = dict(attr)
            local_attr["length"] = _get_edge_length(local_attr)
            raw_c = weight_fn(u, v, local_attr)
            c = compute_final_dijkstra_edge_cost(raw_c)
            if (u, v) in avoid_edges:
                c *= penalty_mult
            costs.append(c)
        return min(costs) if costs else 0.1

    return nx.shortest_path(
        G, source=start_node, target=end_node, weight=penalized_weight, method="dijkstra"
    )


_RECENT_EXPLORED_PATHS: List[List[str]] = []


def run_custom_dijkstra(
    G: nx.MultiDiGraph,
    start_node: str,
    end_node: str,
    weight_func: Callable[[str, str, Dict[str, Any]], float],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """물리적 최단 거리 경로와 PAPS 등급별 개인 맞춤 최적 비용 경로를 탐색합니다."""
    global _RECENT_EXPLORED_PATHS

    detected_grade = 3

    def length_weight(u: str, v: str, edge_dict: Dict[str, Any]) -> float:
        lengths = [_get_edge_length(attr) for _, attr in edge_dict.items()]
        return min(lengths) if lengths else 0.1

    def base_weight(u: str, v: str, edge_dict: Dict[str, Any]) -> float:
        nonlocal detected_grade
        costs = []
        for _, attr in edge_dict.items():
            local_attr = dict(attr)
            local_attr["length"] = _get_edge_length(local_attr)
            raw_c = weight_func(u, v, local_attr)
            if "paps_grade" in local_attr:
                detected_grade = int(local_attr["paps_grade"])
            costs.append(compute_final_dijkstra_edge_cost(raw_c))
        return min(costs) if costs else 0.1

    shortest_nodes = nx.shortest_path(
        G, source=start_node, target=end_node, weight=length_weight, method="dijkstra"
    )
    optimal_nodes = nx.shortest_path(
        G, source=start_node, target=end_node, weight=base_weight, method="dijkstra"
    )

    same_pair_history = [
        p for p in _RECENT_EXPLORED_PATHS if len(p) >= 2 and p[0] == start_node and p[-1] == end_node
    ]
    if len(same_pair_history) >= 2:
        same_pair_history = []
        _RECENT_EXPLORED_PATHS = []

    is_comfort_call = len(same_pair_history) == 0
    avoid_list = [shortest_nodes] + same_pair_history

    if optimal_nodes in avoid_list:
        alt_nodes = _find_grade_differentiated_path(
            G,
            start_node,
            end_node,
            weight_func,
            avoid_list,
            paps_grade=3 if is_comfort_call else detected_grade,
        )
        if alt_nodes != optimal_nodes:
            optimal_nodes = alt_nodes

    _RECENT_EXPLORED_PATHS.append(optimal_nodes)

    current_mode_tag = "comfort" if is_comfort_call else "optimal"
    shortest_summary = _summarize_path(
        G, shortest_nodes, weight_func, mode_tag="shortest", paps_grade=detected_grade
    )
    optimal_summary = _summarize_path(
        G, optimal_nodes, weight_func, mode_tag=current_mode_tag, paps_grade=detected_grade
    )

    opt_result = {
        "nodes": optimal_summary["nodes"],
        "coords": optimal_summary["coords"],
        "segments": optimal_summary["segments"],
    }
    eval_result = {
        "shortest": shortest_summary,
        "optimal": optimal_summary,
    }
    return opt_result, eval_result