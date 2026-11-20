from typing import Dict, Set, Union
import networkx as nx


def check_network_connectivity(
    G: Union[nx.Graph, nx.DiGraph, nx.MultiDiGraph],
    start_node: str,
) -> Dict[str, Union[bool, int, Set[str]]]:
    if G is None or G.number_of_nodes() == 0:
        return {
            "is_connected": False,
            "reachable_count": 0,
            "total_nodes": 0,
            "isolated_nodes": set(),
            "reachable_nodes": set(),
        }

    undirected = G.to_undirected()
    all_nodes: Set[str] = set(undirected.nodes())

    if start_node not in undirected:
        return {
            "is_connected": False,
            "reachable_count": 0,
            "total_nodes": len(all_nodes),
            "isolated_nodes": all_nodes,
            "reachable_nodes": set(),
        }

    reachable: Set[str] = set(nx.node_connected_component(undirected, start_node))
    isolated: Set[str] = all_nodes - reachable

    return {
        "is_connected": len(isolated) == 0,
        "reachable_count": len(reachable),
        "total_nodes": len(all_nodes),
        "isolated_nodes": isolated,
        "reachable_nodes": reachable,
    }