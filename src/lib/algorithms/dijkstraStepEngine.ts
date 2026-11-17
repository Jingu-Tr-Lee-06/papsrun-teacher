import { CampusNode, CampusEdge } from "@/types/road";

export interface DijkstraStep {
  stepIndex: number;
  currentNodeId: string | null;
  visitedNodes: string[];
  distances: Record<string, number>;
  previousNodes: Record<string, string | null>;
  evaluatedEdgeId: string | null;
  description: string;
}

export interface DijkstraSimulationResult {
  steps: DijkstraStep[];
  finalDistances: Record<string, number>;
  finalPreviousNodes: Record<string, string | null>;
  shortestPath: string[]; // start -> end 최종 경로 노드 ID 배열
}

export function generateDijkstraSteps(
  nodes: Record<string, CampusNode>,
  edges: Record<string, CampusEdge>,
  startNodeId: string,
  targetNodeId?: string
): DijkstraSimulationResult {
  const nodeIds = Object.keys(nodes);
  const steps: DijkstraStep[] = [];

  const distances: Record<string, number> = {};
  const previousNodes: Record<string, string | null> = {};
  const visited = new Set<string>();

  // 1. 초기화 단계
  nodeIds.forEach((nid) => {
    distances[nid] = Infinity;
    previousNodes[nid] = null;
  });
  distances[startNodeId] = 0;

  // 인접 리스트 생성 (양방향 도로 반영)
  interface AdjEdge {
    edgeId: string;
    neighborId: string;
    weight: number;
  }
  const adj: Record<string, AdjEdge[]> = {};
  nodeIds.forEach((nid) => {
    adj[nid] = [];
  });

  Object.values(edges).forEach((edge) => {
    if (adj[edge.source] && adj[edge.target]) {
      // 5차시 통합 비용(totalCost)이 있으면 사용, 없으면 실거리(distance) 사용
      const cost = edge.distance;
      adj[edge.source].push({ edgeId: edge.id, neighborId: edge.target, weight: cost });
      adj[edge.target].push({ edgeId: edge.id, neighborId: edge.source, weight: cost });
    }
  });

  steps.push({
    stepIndex: 0,
    currentNodeId: startNodeId,
    visitedNodes: [],
    distances: { ...distances },
    previousNodes: { ...previousNodes },
    evaluatedEdgeId: null,
    description: `[초기화] 시작 노드 [${startNodeId}]의 거리를 0으로 설정하고, 나머지 모든 노드를 ∞(무한대)로 설정했습니다.`,
  });

  // 2. 다익스트라 루프 추적
  let stepCounter = 1;

  while (visited.size < nodeIds.length) {
    // 미방문 노드 중 최소 거리 노드 추출 (Min-Heap 역할)
    let minNode: string | null = null;
    let minDist = Infinity;

    for (const nid of nodeIds) {
      if (!visited.has(nid) && distances[nid] < minDist) {
        minDist = distances[nid];
        minNode = nid;
      }
    }

    if (!minNode || minDist === Infinity) {
      // 더 이상 도달 가능한 노드가 없음
      break;
    }

    visited.add(minNode);

    steps.push({
      stepIndex: stepCounter++,
      currentNodeId: minNode,
      visitedNodes: Array.from(visited),
      distances: { ...distances },
      previousNodes: { ...previousNodes },
      evaluatedEdgeId: null,
      description: `[노드 선택] 미방문 노드 중 누적 거리가 가장 짧은 노드 [${minNode}](누적: ${minDist.toFixed(1)}m)를 확정 방문했습니다.`,
    });

    if (targetNodeId && minNode === targetNodeId) {
      // 목표 노드에 도달했으면 조기 종료 가능
      break;
    }

    // 인접 노드 완화 (Edge Relaxation)
    const neighbors = adj[minNode] || [];
    for (const { edgeId, neighborId, weight } of neighbors) {
      if (!visited.has(neighborId)) {
        const newDist = distances[minNode] + weight;
        const oldDist = distances[neighborId];

        if (newDist < oldDist) {
          distances[neighborId] = Math.round(newDist * 10) / 10;
          previousNodes[neighborId] = minNode;

          steps.push({
            stepIndex: stepCounter++,
            currentNodeId: minNode,
            visitedNodes: Array.from(visited),
            distances: { ...distances },
            previousNodes: { ...previousNodes },
            evaluatedEdgeId: edgeId,
            description: `[거리 갱신/완화] 도로 [${edgeId}]를 통해 노드 [${neighborId}]로 가는 더 짧은 경로 발견! (${oldDist === Infinity ? "∞" : oldDist.toFixed(1)}m ➔ ${newDist.toFixed(1)}m)`,
          });
        }
      }
    }
  }

  // 최종 최단 경로 역추적
  const shortestPath: string[] = [];
  if (targetNodeId && distances[targetNodeId] !== Infinity) {
    let curr: string | null = targetNodeId;
    while (curr) {
      shortestPath.unshift(curr);
      curr = previousNodes[curr];
    }
  }

  return {
    steps,
    finalDistances: distances,
    finalPreviousNodes: previousNodes,
    shortestPath,
  };
}