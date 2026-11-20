from typing import Any, Dict, List, Optional, Tuple
import networkx as nx


def build_map_render_payload(
    G: nx.MultiDiGraph,
    opt_coords: List[List[float]],
    short_coords: List[List[float]],
    comfort_coords: Optional[List[List[float]]] = None,
    masked_start: Optional[Tuple[float, float]] = None,
    masked_end: Optional[Tuple[float, float]] = None,
) -> Dict[str, Any]:
    """Leaflet 프론트엔드 지도 렌더링용 3종 경로(최단·쾌적·PAPS맞춤) 직렬화 데이터를 생성합니다."""
    all_lats = [float(d.get("lat", 36.4675)) for _, d in G.nodes(data=True)]
    all_lons = [float(d.get("lon", 127.1400)) for _, d in G.nodes(data=True)]

    center_lat = round(sum(all_lats) / len(all_lats), 6) if all_lats else 36.4675
    center_lon = round(sum(all_lons) / len(all_lons), 6) if all_lons else 127.1400

    network_edges: List[Dict[str, Any]] = []
    seen = set()
    for u, v, data in G.edges(data=True):
        pair = tuple(sorted((str(u), str(v))))
        if pair in seen:
            continue
        seen.add(pair)
        network_edges.append(
            {
                "u": str(u),
                "v": str(v),
                "coords": [
                    [float(G.nodes[u]["lat"]), float(G.nodes[u]["lon"])],
                    [float(G.nodes[v]["lat"]), float(G.nodes[v]["lon"])],
                ],
                "surface": str(data.get("surface", "asphalt")),
                "slope_pct": float(data.get("slope_pct", 0.0)),
                "is_shaded": bool(data.get("is_shaded", False)),
            }
        )

    markers: Dict[str, Any] = {}
    if masked_start:
        markers["start"] = {
            "coords": [masked_start[0], masked_start[1]],
            "label": "출발 거점 (차분 프라이버시 보호)",
            "color": "#16a34a",
        }
    if masked_end:
        markers["end"] = {
            "coords": [masked_end[0], masked_end[1]],
            "label": "도착 거점 (차분 프라이버시 보호)",
            "color": "#dc2626",
        }

    return {
        "center": [center_lat, center_lon],
        "zoom": 17,
        "network_edges": network_edges,
        "shortest_path": {
            "coords": short_coords,
            "color": "#E63946",
            "weight": 5,
            "dash_array": "7, 9",
            "label": "1. 물리적 최단 경로 (급경사·직사광선 미보정)",
        },
        "comfort_path": {
            "coords": comfort_coords or [],
            "color": "#0284C7",
            "weight": 5,
            "label": "2. 일반 쾌적 경로 (그늘·완만 경사 표준 우회)",
        },
        "optimal_path": {
            "coords": opt_coords,
            "color": "#16A34A",
            "weight": 7,
            "label": "3. PAPSrun AI 개인 맞춤 경로 (생체역학·심박·복사열 최적화)",
        },
        "markers": markers,
    }