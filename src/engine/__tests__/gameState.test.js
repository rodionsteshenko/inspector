import { describe, it, expect } from 'vitest';
import {
  PHASES,
  CHUNKS_PER_DAY,
  MAX_DAYS,
  createInitialGameState,
  advanceChunk,
  transitionToNight,
  transitionToDawn,
  transitionToDay,
  setNightAction,
  recordConversation,
  updateCharacterInState,
  getConversationsAvailable,
} from '../gameState.js';

describe('createInitialGameState', () => {
  it('starts on day 1, chunk 1, day phase', () => {
    const state = createInitialGameState();
    expect(state.day).toBe(1);
    expect(state.chunk).toBe(1);
    expect(state.phase).toBe(PHASES.DAY);
  });

  it('has 12 characters (11 NPCs + player)', () => {
    const state = createInitialGameState();
    expect(state.characters).toHaveLength(12);
  });

  it('player exists with inspector role', () => {
    const state = createInitialGameState();
    const player = state.characters.find(c => c.id === 'player');
    expect(player).not.toBeUndefined();
    expect(player.role).toBe('inspector');
    expect(player.alive).toBe(true);
  });

  it('all characters are alive', () => {
    const state = createInitialGameState();
    expect(state.characters.every(c => c.alive)).toBe(true);
  });

  it('has correct role distribution among NPCs', () => {
    const state = createInitialGameState();
    const npcs = state.characters.filter(c => c.id !== 'player');
    const roles = npcs.map(c => c.role);
    const countOf = (r) => roles.filter(x => x === r).length;
    expect(countOf('mafia')).toBe(2);
    expect(countOf('doctor')).toBe(1);
    expect(countOf('journalist')).toBe(1);
    expect(countOf('mason')).toBe(1);
    expect(countOf('citizen')).toBe(6);
  });

  it('initializes empty evidence board', () => {
    const state = createInitialGameState();
    expect(state.evidenceBoard.confirmedRoles).toEqual({});
    expect(state.evidenceBoard.movementLogs).toEqual([]);
    expect(state.evidenceBoard.contradictions).toEqual([]);
    expect(state.evidenceBoard.deathLog).toEqual([]);
    expect(state.evidenceBoard.alliances).toEqual([]);
  });

  it('player location is on the map', () => {
    const state = createInitialGameState();
    const validLocations = ['town_square', 'church', 'docks', 'market', 'tavern', 'library', 'alley', 'cellar'];
    expect(validLocations).toContain(state.playerLocation);
  });

  it('identifies mafia IDs correctly', () => {
    const state = createInitialGameState();
    expect(state.mafiaIds).toHaveLength(2);
    for (const id of state.mafiaIds) {
      const char = state.characters.find(c => c.id === id);
      expect(char.role).toBe('mafia');
    }
  });

  it('masonKnownInnocent is a valid innocent character', () => {
    const state = createInitialGameState();
    if (state.masonKnownInnocent) {
      const char = state.characters.find(c => c.id === state.masonKnownInnocent);
      expect(char).not.toBeUndefined();
      expect(char.role).not.toBe('mafia');
    }
  });
});

describe('advanceChunk', () => {
  it('increments chunk during day phase', () => {
    const state = createInitialGameState();
    const next = advanceChunk(state);
    expect(next.chunk).toBe(2);
    expect(next.phase).toBe(PHASES.DAY);
  });

  it('transitions to night phase after chunk 8', () => {
    const state = { ...createInitialGameState(), chunk: 8 };
    const next = advanceChunk(state);
    expect(next.phase).toBe(PHASES.NIGHT);
  });

  it('throws if not in day phase', () => {
    const state = { ...createInitialGameState(), phase: PHASES.NIGHT };
    expect(() => advanceChunk(state)).toThrow();
  });
});

describe('transitionToNight', () => {
  it('transitions from vote to night', () => {
    const state = { ...createInitialGameState(), phase: PHASES.VOTE };
    const next = transitionToNight(state);
    expect(next.phase).toBe(PHASES.NIGHT);
    expect(next.nightActions.mafiaTarget).toBeNull();
    expect(next.nightActions.doctorTarget).toBeNull();
    expect(next.nightActions.inspectorTarget).toBeNull();
  });

  it('accepts night phase (resets night actions)', () => {
    const state = { ...createInitialGameState(), phase: PHASES.NIGHT };
    const next = transitionToNight(state);
    expect(next.phase).toBe(PHASES.NIGHT);
    expect(next.nightActions.mafiaTarget).toBeNull();
  });

  it('throws if in day phase', () => {
    const state = createInitialGameState(); // DAY phase
    expect(() => transitionToNight(state)).toThrow();
  });
});

describe('transitionToDawn', () => {
  it('transitions from night to dawn with result', () => {
    const state = { ...createInitialGameState(), phase: PHASES.NIGHT };
    const result = { killResult: { type: 'no_kill' }, investigationResult: null };
    const next = transitionToDawn(state, result);
    expect(next.phase).toBe(PHASES.DAWN);
    expect(next.lastNightResult).toEqual(result);
  });

  it('throws if not in night phase', () => {
    const state = createInitialGameState();
    expect(() => transitionToDawn(state, {})).toThrow();
  });
});

describe('transitionToDay', () => {
  it('transitions from dawn to day, increments day counter', () => {
    const state = { ...createInitialGameState(), phase: PHASES.DAWN, day: 1 };
    const next = transitionToDay(state);
    expect(next.phase).toBe(PHASES.DAY);
    expect(next.day).toBe(2);
    expect(next.chunk).toBe(1);
    expect(next.conversationsUsed).toBe(0);
  });

  it('throws if not in dawn phase', () => {
    const state = createInitialGameState();
    expect(() => transitionToDay(state)).toThrow();
  });
});

describe('setNightAction', () => {
  it('sets inspector target during night', () => {
    const state = { ...createInitialGameState(), phase: PHASES.NIGHT };
    const next = setNightAction(state, 'inspectorTarget', 'brad_barber');
    expect(next.nightActions.inspectorTarget).toBe('brad_barber');
  });

  it('sets playerEliminate target during night', () => {
    const state = { ...createInitialGameState(), phase: PHASES.NIGHT };
    const next = setNightAction(state, 'playerEliminate', 'brad_barber');
    expect(next.nightActions.playerEliminate).toBe('brad_barber');
  });

  it('throws if not in night phase', () => {
    const state = createInitialGameState();
    expect(() => setNightAction(state, 'inspectorTarget', 'brad_barber')).toThrow();
  });

  it('throws for invalid action type', () => {
    const state = { ...createInitialGameState(), phase: PHASES.NIGHT };
    expect(() => setNightAction(state, 'invalidAction', 'brad')).toThrow();
  });
});

describe('recordConversation', () => {
  it('increments conversationsUsed', () => {
    const state = createInitialGameState();
    const next = recordConversation(state);
    expect(next.conversationsUsed).toBe(1);
  });

  it('throws when no slots remaining', () => {
    const state = {
      ...createInitialGameState(),
      conversationsUsed: 3,
      conversationsAvailable: 3,
    };
    expect(() => recordConversation(state)).toThrow();
  });
});
