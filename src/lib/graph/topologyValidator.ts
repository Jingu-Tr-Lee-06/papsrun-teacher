import { CampusNode, CampusEdge } from "../../types/road";

export interface TopologyReport {
  isValid: boolean;
  totalNodes: number;
  totalEdges: number;
  componentCount: number;
  isWeaklyConnected: boolean;
  isolatedNodeIds: string[];
  deadEndNodeIds: string[];
  diagnosticMessages: string[];
}

/**
 * 인접 리스트 기반 도로망 위상 및 연결성 무결성 진단
 * @param nodes 도로망 노드 레코드
 * @param edges 도로망 간선 레코드
 * @returns 위상 진단 보고서 객체
 */
export function validateCampusTopology(
  nodes: Record<string, CampusNode>,
  edges: Record<string, CampusEdge>
): TopologyReport {
  const nodeIds = Object.keys(nodes);
  const edgeList = Object.values(edges);

  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  const undirectedAdj: Record<string, string[]> = {};

  // 차수 및 무방향 인접 리스트 초기화
  nodeIds.forEach((id) => {
    inDegree[id] = 0;
    outDegree[id] = 0;
    undirectedAdj[id] = [];
  });

  // 간선 데이터 반영
  edgeList.forEach((edge) => {
    const { source, target } = edge;
    if (outDegree[source] !== undefined) outDegree[source]++;
    if (inDegree[target] !== undefined) inDegree[target]++;

    if (undirectedAdj[source] && undirectedAdj[target]) {
      undirectedAdj[source].push(target);
      undirectedAdj[target].push(source);
    }
  });

  // 1. 고립 노드 검출 (진입 차수 = 0, 진출 차수 = 0)
  const isolatedNodeIds = nodeIds.filter(
    (id) => inDegree[id] === 0 && outDegree[id] === 0
  );

  // 2. 막다른 길 검출 (진입은 있으나 나갈 수 없는 노드)
  const deadEndNodeIds = nodeIds.filter(
    (id) => inDegree[id] > 0 && outDegree[id] === 0
  );

  // 3. 무방향 BFS를 통한 연결 컴포넌트(덩어리) 개수 산출
  const visited = new Set<string>();
  let componentCount = 0;

  nodeIds.forEach((id) => {
    if (!visited.has(id) && !isolatedNodeIds.includes(id)) {
      componentCount++;
      const queue: string[] = [id];
      visited.add(id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = undirectedAdj[curr] || [];
        neighbors.forEach((nbr) => {
          if (!visited.has(nbr)) {
            visited.add(nbr);
            queue.push(nbr);
          }
        });
      }
    }
  });

  const isWeaklyConnected = componentCount === 1 && isolatedNodeIds.length === 0;
  const diagnosticMessages: string[] = [];

  if (nodeIds.length === 0) {
    diagnosticMessages.push("등록된 노드가 없습니다.");
  } else {
    if (isolatedNodeIds.length > 0) {
      diagnosticMessages.push(`고립 노드 ${isolatedNodeIds.length}개 발견`);
    }
    if (deadEndNodeIds.length > 0) {
      diagnosticMessages.push(`막다른 길 ${deadEndNodeIds.length}개 발견`);
    }
    if (componentCount > 1) {
      diagnosticMessages.push(`네트워크 ${componentCount}개 구역 분단`);
    }
    if (isWeaklyConnected) {
      diagnosticMessages.push("도로망 완전 연결 상태");
    }
  }

  return {
    isValid: isWeaklyConnected,
    totalNodes: nodeIds.length,
    totalEdges: edgeList.length,
    componentCount: Math.max(1, componentCount),
    isWeaklyConnected,
    isolatedNodeIds,
    deadEndNodeIds,
    diagnosticMessages,
  };
}