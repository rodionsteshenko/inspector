import { describe, it, expect } from 'vitest';
import {
  createEvidenceBoard,
  addMovementLog,
  addConfirmedRole,
  addDeathLog,
  addAlliance,
  detectContradiction,
  detectMovementImpossibility,
  detectAllContradictions,
  addContradiction,
  getContradictionsForCharacter,
  getMovementLogsForCharacter,
} from '../evidenceBoard.js';
import { isAdjacent } from '../map.js';

function makeBoard() {
  return createEvidenceBoard();
}

describe('createEvidenceBoard', () => {
  it('creates empty board', () => {
    const board = createEvidenceBoard();
    expect(board.confirmedRoles).toEqual({});
    expect(board.movementLogs).toEqual([]);
    expect(board.contradictions).toEqual([]);
    expect(board.deathLog).toEqual([]);
    expect(board.alliances).toEqual([]);
  });
});

describe('addMovementLog', () => {
  it('adds entry immutably', () => {
    const board = makeBoard();
    const entry = { characterId: 'brad', location: 'tavern', day: 1, chunk: 2 };
    const updated = addMovementLog(board, entry);
    expect(updated.movementLogs).toHaveLength(1);
    expect(board.movementLogs).toHaveLength(0); // original unchanged
  });
});

describe('addConfirmedRole', () => {
  it('adds role immutably', () => {
    const board = makeBoard();
    const updated = addConfirmedRole(board, 'brad', 'citizen');
    expect(updated.confirmedRoles['brad']).toBe('citizen');
    expect(board.confirmedRoles['brad']).toBeUndefined();
  });

  it('can overwrite a role (re-investigation)', () => {
    const board = addConfirmedRole(makeBoard(), 'brad', 'citizen');
    const updated = addConfirmedRole(board, 'brad', 'mafia');
    expect(updated.confirmedRoles['brad']).toBe('mafia');
  });
});

describe('addAlliance', () => {
  it('adds an alliance', () => {
    const board = makeBoard();
    const updated = addAlliance(board, 'brad_barber');
    expect(updated.alliances).toContain('brad_barber');
  });

  it('does not add duplicate alliances', () => {
    let board = makeBoard();
    board = addAlliance(board, 'brad_barber');
    board = addAlliance(board, 'brad_barber');
    expect(board.alliances.filter(a => a === 'brad_barber')).toHaveLength(1);
  });
});

describe('detectContradiction', () => {
  it('detects when character was observed elsewhere', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'church', day: 1, chunk: 3 });
    const contradiction = detectContradiction(board, 'brad', 'tavern', 1, 3);
    expect(contradiction).not.toBeNull();
    expect(contradiction.characterId).toBe('brad');
    expect(contradiction.claimedLocation).toBe('tavern');
    expect(contradiction.observedLocation).toBe('church');
  });

  it('returns null when location matches observed', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'tavern', day: 1, chunk: 3 });
    const contradiction = detectContradiction(board, 'brad', 'tavern', 1, 3);
    expect(contradiction).toBeNull();
  });

  it('returns null when no observation exists', () => {
    const board = makeBoard();
    const contradiction = detectContradiction(board, 'brad', 'tavern', 1, 3);
    expect(contradiction).toBeNull();
  });
});

describe('detectMovementImpossibility', () => {
  it('detects when character cannot have moved from A to B in one chunk', () => {
    let board = makeBoard();
    // Brad was at cellar at chunk 1; claims to be at church at chunk 2
    // cellar -> alley -> tavern -> town_square -> church = 4 moves minimum
    board = addMovementLog(board, { characterId: 'brad', location: 'cellar', day: 1, chunk: 1 });
    const impossibility = detectMovementImpossibility(board, 'brad', 'church', 1, 2, isAdjacent);
    expect(impossibility).not.toBeNull();
    expect(impossibility.type).toBe('movement_impossible');
  });

  it('returns null when movement is possible (adjacent)', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'town_square', day: 1, chunk: 1 });
    const result = detectMovementImpossibility(board, 'brad', 'tavern', 1, 2, isAdjacent);
    expect(result).toBeNull();
  });

  it('returns null when character stays at same location', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'tavern', day: 1, chunk: 1 });
    const result = detectMovementImpossibility(board, 'brad', 'tavern', 1, 2, isAdjacent);
    expect(result).toBeNull();
  });

  it('returns null for chunk 1 (no previous observation possible)', () => {
    const board = makeBoard();
    const result = detectMovementImpossibility(board, 'brad', 'church', 1, 1, isAdjacent);
    expect(result).toBeNull();
  });
});

describe('detectAllContradictions', () => {
  it('finds contradictions in character claims', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'church', day: 1, chunk: 3 });

    const claims = [
      { characterId: 'brad', claimedLocation: 'tavern', day: 1, chunk: 3 },
    ];
    const contradictions = detectAllContradictions(board, claims, isAdjacent);
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it('finds no contradictions when claims match observations', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'tavern', day: 1, chunk: 3 });

    const claims = [
      { characterId: 'brad', claimedLocation: 'tavern', day: 1, chunk: 3 },
    ];
    const contradictions = detectAllContradictions(board, claims, isAdjacent);
    expect(contradictions).toHaveLength(0);
  });
});

describe('addContradiction', () => {
  it('adds a contradiction', () => {
    const board = makeBoard();
    const c = { characterId: 'brad', day: 1, chunk: 3, type: 'direct', description: 'test' };
    const updated = addContradiction(board, c);
    expect(updated.contradictions).toHaveLength(1);
  });

  it('does not add duplicate contradictions', () => {
    let board = makeBoard();
    const c = { characterId: 'brad', day: 1, chunk: 3, type: 'direct', description: 'test' };
    board = addContradiction(board, c);
    board = addContradiction(board, c);
    expect(board.contradictions).toHaveLength(1);
  });
});

describe('getMovementLogsForCharacter', () => {
  it('returns logs sorted by day and chunk', () => {
    let board = makeBoard();
    board = addMovementLog(board, { characterId: 'brad', location: 'church', day: 1, chunk: 3 });
    board = addMovementLog(board, { characterId: 'brad', location: 'tavern', day: 1, chunk: 1 });
    board = addMovementLog(board, { characterId: 'elena', location: 'market', day: 1, chunk: 2 });

    const logs = getMovementLogsForCharacter(board, 'brad');
    expect(logs).toHaveLength(2);
    expect(logs[0].chunk).toBe(1);
    expect(logs[1].chunk).toBe(3);
  });
});
