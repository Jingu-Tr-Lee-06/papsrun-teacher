import { CampusNode, CampusEdge } from "@/types/road";

export interface ComponentInfo {
  id: number;
  nodeIds: string[];
  edgeIds: string[];
}

export interface TopologyReport {
  isFullyConnected: boolean;       // 완전 연결 여부 (컴포넌트 1개)
  totalNodes: number;
  totalEdges: number;
  componentCount: number;         // 분리된 덩어리 수
  components: ComponentInfo[];
  isolatedNodeIds: string[];      // 연결 도로가 0개인 고립 노드
  deadEndNodeIds: string[];       // 연결 도로가 1개인 막다른 노드
  topologyScore: number;          // 100점 만점 기준 점수
  issues: string[];               // 결함 요약 텍스트
}

export function analyzeTopology(
  nodes: Record<string, CampusNode>,
  edges: Record<string, CampusEdge>
): TopologyReport {
  const nodeIds = Object.keys(nodes);
  const edgeList = Object.values(edges);

  if (nodeIds.length === 0) {
    return {
      isFullyConnected: false,
      totalNodes: 0,
      totalEdges: 0,
      componentCount: 0,
      components: [],
      isolatedNodeIds: [],
      deadEndNodeIds: [],
      topologyScore: 0,
      issues: ["등록된 교차점(노드)이 없습니다."],
    };
  }

  // 1. 인접 리스트(Adjacency List) 및 차수(Degree) 구성 (무방향 그래프 기준)
  const adj: Record<string, Set<string>> = {};
  const degree: Record<string, number> = {};

  nodeIds.forEach((nid) => {
    adj[nid] = new Set();
    degree[nid] = 0;
  });

  edgeList.forEach((e) => {
    if (adj[e.source] && adj[e.target]) {
      adj[e.source].add(e.target);
      adj[e.target].add(e.source);
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
    }
  });

  // 2. 고립 노드(Degree = 0) 및 막다른 길(Degree = 1) 검출
  const isolatedNodeIds: string[] = [];
  const deadEndNodeIds: string[] = [];

  nodeIds.forEach((nid) => {
    const deg = degree[nid] || 0;
    if (deg === 0) {
      isolatedNodeIds.push(nid);
    } else if (deg === 1) {
      deadEndNodeIds.push(nid);
    }
  });

  // 3. 연결 컴포넌트(Connected Components) BFS 탐색
  const visited = new Set<string>();
  const components: ComponentInfo[] = [];

  nodeIds.forEach((startNodeId) => {
    if (visited.has(startNodeId)) return;

    const currentComponentNodes: string[] = [];
    const queue: string[] = [startNodeId];
    visited.add(startNodeId);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      currentComponentNodes.push(curr);

      adj[curr]?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    // 해당 컴포넌트에 속한 간선 추출
    const nodeSet = new Set(currentComponentNodes);
    const currentComponentEdges = edgeList
      .filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
      .map((e) => e.id);

    components.push({
      id: components.length + 1,
      nodeIds: currentComponentNodes,
      edgeIds: currentComponentEdges,
    });
  });

  // 4. 위상 무결성 점수 및 이슈 진단
  const issues: string[] = [];
  let score = 100;

  if (isolatedNodeIds.length > 0) {
    score -= Math.min(30, isolatedNodeIds.length * 10);
    issues.push(`도로가 연결되지 않은 고립 노드가 ${isolatedNodeIds.length}개 있습니다.`);
  }

  if (components.length > 1) {
    score -= Math.min(40, (components.length - 1) * 15);
    issues.push(`도로망이 서로 이어지지 않고 ${components.length}개 구역으로 단절되어 있습니다.`);
  }

  if (deadEndNodeIds.length > 0) {
    score -= Math.min(20, deadEndNodeIds.length * 5);
    issues.push(`순환하지 못하고 막혀있는 데드엔드 노드가 ${deadEndNodeIds.length}개 있습니다.`);
  }

  score = Math.max(0, score);

  return {
    isFullyConnected: components.length === 1 && isolatedNodeIds.length === 0,
    totalNodes: nodeIds.length,
    totalEdges: edgeList.length,
    componentCount: components.length,
    components,
    isolatedNodeIds,
    deadEndNodeIds,
    topologyScore: score,
    issues: issues.length === 0 ? ["모든 도로망이 완벽하게 연결되어 있습니다! (100점)"] : issues,
  };
}