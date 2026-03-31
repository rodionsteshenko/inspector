// Map graph, adjacency, movement validation

export const MAP_NODES = [
  { id: 'town_square', name: 'Town Square', capacity: 6, visibility: 'public', description: 'The busy center of village life.' },
  { id: 'church', name: 'Church', capacity: 4, visibility: 'public', description: 'A quiet place for prayer and reflection.' },
  { id: 'docks', name: 'Docks', capacity: 4, visibility: 'public', description: 'Where fishermen and traders gather.' },
  { id: 'market', name: 'Market', capacity: 5, visibility: 'public', description: 'Bustling stalls and trading.' },
  { id: 'tavern', name: 'Tavern', capacity: 4, visibility: 'public', description: 'Where gossip flows like ale.' },
  { id: 'library', name: 'Library', capacity: 3, visibility: 'semi_private', description: 'Quiet study and old records.' },
  { id: 'alley', name: 'Alley', capacity: 3, visibility: 'private', description: 'A dark narrow passage.' },
  { id: 'cellar', name: 'Cellar', capacity: 2, visibility: 'private', description: 'Hidden beneath the tavern.' },
];

export const MAP_EDGES = [
  ['town_square', 'church'],
  ['town_square', 'docks'],
  ['town_square', 'market'],
  ['town_square', 'tavern'],
  ['market', 'library'],
  ['tavern', 'alley'],
  ['alley', 'cellar'],
];

export function buildAdjacencyMap(nodes, edges) {
  const adj = {};
  for (const node of nodes) {
    adj[node.id] = [];
  }
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

export const ADJACENCY_MAP = buildAdjacencyMap(MAP_NODES, MAP_EDGES);

export function getAdjacentLocations(nodeId) {
  return ADJACENCY_MAP[nodeId] || [];
}

export function isAdjacent(fromId, toId) {
  return (ADJACENCY_MAP[fromId] || []).includes(toId);
}

export function getNodeById(nodeId) {
  return MAP_NODES.find(n => n.id === nodeId) || null;
}

export function isValidLocation(nodeId) {
  return MAP_NODES.some(n => n.id === nodeId);
}

export function getShortestPath(fromId, toId) {
  if (fromId === toId) return [fromId];
  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const neighbor of ADJACENCY_MAP[current] || []) {
      if (neighbor === toId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

export function getMinimumMoves(fromId, toId) {
  const path = getShortestPath(fromId, toId);
  if (!path) return null;
  return path.length - 1;
}
