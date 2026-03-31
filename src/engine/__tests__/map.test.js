import { describe, it, expect } from 'vitest';
import {
  MAP_NODES,
  MAP_EDGES,
  ADJACENCY_MAP,
  buildAdjacencyMap,
  getAdjacentLocations,
  isAdjacent,
  getNodeById,
  isValidLocation,
  getShortestPath,
  getMinimumMoves,
} from '../map.js';

describe('MAP_NODES', () => {
  it('has exactly 8 nodes', () => {
    expect(MAP_NODES).toHaveLength(8);
  });

  it('has required node properties', () => {
    for (const node of MAP_NODES) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('capacity');
      expect(node).toHaveProperty('visibility');
    }
  });

  it('includes all expected locations', () => {
    const ids = MAP_NODES.map(n => n.id);
    expect(ids).toContain('town_square');
    expect(ids).toContain('church');
    expect(ids).toContain('docks');
    expect(ids).toContain('market');
    expect(ids).toContain('tavern');
    expect(ids).toContain('library');
    expect(ids).toContain('alley');
    expect(ids).toContain('cellar');
  });

  it('cellar has low capacity (private space)', () => {
    const cellar = MAP_NODES.find(n => n.id === 'cellar');
    expect(cellar.capacity).toBeLessThanOrEqual(2);
    expect(cellar.visibility).toBe('private');
  });

  it('town_square has high capacity (public space)', () => {
    const ts = MAP_NODES.find(n => n.id === 'town_square');
    expect(ts.capacity).toBeGreaterThanOrEqual(5);
    expect(ts.visibility).toBe('public');
  });
});

describe('buildAdjacencyMap', () => {
  it('creates bidirectional edges', () => {
    const adj = buildAdjacencyMap(MAP_NODES, MAP_EDGES);
    for (const [a, b] of MAP_EDGES) {
      expect(adj[a]).toContain(b);
      expect(adj[b]).toContain(a);
    }
  });

  it('initializes all nodes', () => {
    const adj = buildAdjacencyMap(MAP_NODES, MAP_EDGES);
    for (const node of MAP_NODES) {
      expect(adj).toHaveProperty(node.id);
    }
  });
});

describe('isAdjacent', () => {
  it('returns true for directly connected nodes', () => {
    expect(isAdjacent('town_square', 'church')).toBe(true);
    expect(isAdjacent('town_square', 'docks')).toBe(true);
    expect(isAdjacent('town_square', 'market')).toBe(true);
    expect(isAdjacent('town_square', 'tavern')).toBe(true);
    expect(isAdjacent('market', 'library')).toBe(true);
    expect(isAdjacent('tavern', 'alley')).toBe(true);
    expect(isAdjacent('alley', 'cellar')).toBe(true);
  });

  it('is bidirectional', () => {
    expect(isAdjacent('church', 'town_square')).toBe(true);
    expect(isAdjacent('cellar', 'alley')).toBe(true);
    expect(isAdjacent('library', 'market')).toBe(true);
  });

  it('returns false for non-adjacent nodes', () => {
    expect(isAdjacent('church', 'docks')).toBe(false);
    expect(isAdjacent('cellar', 'town_square')).toBe(false);
    expect(isAdjacent('library', 'tavern')).toBe(false);
    expect(isAdjacent('docks', 'market')).toBe(false);
  });

  it('returns false for same node', () => {
    expect(isAdjacent('town_square', 'town_square')).toBe(false);
  });

  it('returns false for invalid node IDs', () => {
    expect(isAdjacent('town_square', 'nonexistent')).toBe(false);
    expect(isAdjacent('nonexistent', 'church')).toBe(false);
  });
});

describe('getAdjacentLocations', () => {
  it('returns adjacent nodes for town_square', () => {
    const adj = getAdjacentLocations('town_square');
    expect(adj).toContain('church');
    expect(adj).toContain('docks');
    expect(adj).toContain('market');
    expect(adj).toContain('tavern');
  });

  it('returns empty array for unknown node', () => {
    expect(getAdjacentLocations('unknown')).toEqual([]);
  });

  it('cellar only connects to alley', () => {
    const adj = getAdjacentLocations('cellar');
    expect(adj).toEqual(['alley']);
  });
});

describe('getNodeById', () => {
  it('returns node for valid id', () => {
    const node = getNodeById('tavern');
    expect(node).not.toBeNull();
    expect(node.id).toBe('tavern');
  });

  it('returns null for invalid id', () => {
    expect(getNodeById('nonexistent')).toBeNull();
  });
});

describe('isValidLocation', () => {
  it('returns true for valid locations', () => {
    for (const node of MAP_NODES) {
      expect(isValidLocation(node.id)).toBe(true);
    }
  });

  it('returns false for invalid location', () => {
    expect(isValidLocation('nowhere')).toBe(false);
    expect(isValidLocation('')).toBe(false);
  });
});

describe('getShortestPath', () => {
  it('returns single element path for same node', () => {
    expect(getShortestPath('town_square', 'town_square')).toEqual(['town_square']);
  });

  it('returns direct path for adjacent nodes', () => {
    const path = getShortestPath('town_square', 'church');
    expect(path).toEqual(['town_square', 'church']);
  });

  it('finds path from cellar to church', () => {
    // cellar -> alley -> tavern -> town_square -> church (4 moves)
    const path = getShortestPath('cellar', 'church');
    expect(path).not.toBeNull();
    expect(path[0]).toBe('cellar');
    expect(path[path.length - 1]).toBe('church');
    // Verify each step is adjacent
    for (let i = 0; i < path.length - 1; i++) {
      expect(isAdjacent(path[i], path[i + 1])).toBe(true);
    }
  });

  it('finds path from library to docks', () => {
    // library -> market -> town_square -> docks (3 moves)
    const path = getShortestPath('library', 'docks');
    expect(path).not.toBeNull();
    expect(path[0]).toBe('library');
    expect(path[path.length - 1]).toBe('docks');
    for (let i = 0; i < path.length - 1; i++) {
      expect(isAdjacent(path[i], path[i + 1])).toBe(true);
    }
  });
});

describe('getMinimumMoves', () => {
  it('returns 0 for same location', () => {
    expect(getMinimumMoves('town_square', 'town_square')).toBe(0);
  });

  it('returns 1 for adjacent locations', () => {
    expect(getMinimumMoves('town_square', 'church')).toBe(1);
    expect(getMinimumMoves('tavern', 'alley')).toBe(1);
  });

  it('returns correct distance for multi-hop paths', () => {
    // cellar -> alley -> tavern -> town_square -> church = 4 moves
    expect(getMinimumMoves('cellar', 'church')).toBe(4);
    // library -> market -> town_square -> docks = 3 moves
    expect(getMinimumMoves('library', 'docks')).toBe(3);
  });
});
