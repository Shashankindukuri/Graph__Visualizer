import { MyGraphNodeType, MyGraphLinkType } from "../App";

export type EdgeMap = {
  [key: string]: Array<string>;
};

// Convert layout into edge map
// Returns map of nodeIds to list of its outgoing nodes
export function convertToEdgeMap(links: Array<MyGraphLinkType>, directed: boolean): EdgeMap {
  const edgeMap: { [key: string]: Set<string> } = {};

  for (const link of links) {
    const src = link.source;
    const trg = link.target;

    if (directed) {
      if (!edgeMap[src]) {
        edgeMap[src] = new Set<string>();
      }
      edgeMap[src].add(trg);
    } else {
      if (!edgeMap[src]) {
        edgeMap[src] = new Set<string>();
      }
      edgeMap[src].add(trg);

      if (!edgeMap[trg]) {
        edgeMap[trg] = new Set<string>();
      }
      edgeMap[trg].add(src);
    }
  }

  if (!directed) {
    for (let src of Object.keys(edgeMap)) {
      edgeMap[src] = Array.from(edgeMap[src]);
    }
  }

  return edgeMap as EdgeMap;
}

// Derive start node from nodes and edges (assuming startNode is not defined)
// 1. Find the node that has indegree 0 and outdegree > 0
// 2. If multiple satisfy #1, return the smallest id
// 3. Else return smallest id out of all nodes with at least 1 outdegree
export function deriveStartNode(nodes: Array<MyGraphNodeType>, edgeMap: EdgeMap): string {
  const nodesWithIn = new Set<string>(); // Nodes with indegree
  const nodesWithOut = new Set<string>(); // Nodes with outdegree
  const currentNodes = new Set<string>();
  const currentNodeList: string[] = []; // Explicitly typed as string[]

  for (let node of nodes) {
    currentNodes.add(node.id);
    currentNodeList.push(node.id);
  }

  for (let src of Object.keys(edgeMap)) {
    if (currentNodes.has(src)) {
      nodesWithOut.add(src);
      const children = edgeMap[src];
      for (let trg of children) {
        nodesWithIn.add(trg);
      }
    }
  }

  // Find 1.
  let candidates = new Set<string>();
  for (let node of nodes) {
    if (!nodesWithIn.has(node.id) && nodesWithOut.has(node.id)) {
      candidates.add(node.id);
    }
  }

  if (candidates.size > 0) {
    const arr = Array.from(candidates);
    arr.sort();
    return arr[0];
  }

  // If 3 doesn't exist, just return smallest nodeId
  if (nodesWithOut.size === 0) {
    currentNodeList.sort();
    return currentNodeList[0];
  }

  // Find 3.
  const arr = Array.from(nodesWithOut);
  arr.sort();
  return arr[0];
}

export function getExtraNodes(
  nodes: Array<MyGraphNodeType>,
  links: Array<MyGraphLinkType>
): Array<MyGraphNodeType> {
  const connectedNodeIds = new Set<string>();
  const rtn: Array<MyGraphNodeType> = [];

  for (let link of links) {
    connectedNodeIds.add(link.source);
    connectedNodeIds.add(link.target);
  }

  for (let node of nodes) {
    if (!connectedNodeIds.has(node.id)) {
      rtn.push(node);
    }
  }

  return rtn;
}

// Get all disconnected components
// Return list of list of nodes
// Note: the connected component with the start node should always be first in the returned list
export function getDisconnectedComponents(
  nodes: Array<MyGraphNodeType>,
  links: Array<MyGraphLinkType>,
  startNode: string | undefined
): Array<Array<MyGraphNodeType>> {
  const idToNodes: { [key: string]: MyGraphNodeType } = {};

  for (let node of nodes) {
    idToNodes[node.id] = node;
  }

  const rtn: Array<Array<MyGraphNodeType>> = [];
  const connectedNodeIds = new Set<string>();

  for (let link of links) {
    connectedNodeIds.add(link.source);
    connectedNodeIds.add(link.target);
  }

  const edgeMap: EdgeMap = convertToEdgeMap(links, false);
  const seen = new Set<string>();

  for (let nodeId of Array.from(connectedNodeIds)) {
    if (!seen.has(nodeId)) {
      const collected = new Set<string>();
      dfs(nodeId, edgeMap, seen, collected);
      // Collect all the nodes objects in a list
      const toAdd: Array<MyGraphNodeType> = [];
      for (let c of Array.from(collected)) {
        toAdd.push(idToNodes[c]);
      }

      if (startNode && collected.has(startNode)) {
        rtn.unshift(toAdd);
      } else {
        rtn.push(toAdd);
      }
    }
  }

  return rtn;
}

function dfs(nodeId: string, edgeMap: EdgeMap, seen: Set<string>, collected: Set<string>) {
  if (seen.has(nodeId)) return;
  seen.add(nodeId);
  collected.add(nodeId);
  const children = edgeMap[nodeId];
  if (!children) return;
  for (let child of children) {
    dfs(child, edgeMap, seen, collected);
  }
}

export function isStartNodeInComponent(startNode: string, nodes: Array<MyGraphNodeType>): boolean {
  return nodes.some(node => node.id === startNode);
}

// Used for undirected graphs: remove links that are backlinks of another edge
export function removeRepeatedEdges(links: Array<MyGraphLinkType>): Array<MyGraphLinkType> {
  const seen = new Set<string>();
  const rtn: Array<MyGraphLinkType> = [];

  for (let link of links) {
    const key = `${link.source}-linkTo-${link.target}`;
    const backKey = `${link.target}-linkTo-${link.source}`;

    if (seen.has(backKey)) {
      continue;
    }

    seen.add(key);
    rtn.push(link);
  }

  return rtn;
}
