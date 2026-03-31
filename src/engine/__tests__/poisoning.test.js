import { describe, test, expect } from 'vitest';
import {
  isMafiaCoordinated,
  choosePoisonTarget,
  hasMafiaReachedTarget,
  getNextStep,
  getMafiaKillerNextMove,
  createDayMafiaState,
  updateMafiaState,
  flagProximityAfterDeath,
  planMafiaDay,
} from '../poisoning.js';
import { createGameWithSetup } from '../gameState.js';
import { ROLES } from '../roles.js';

function makeDeterministicRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeSetupState(seed = 1) {
  return createGameWithSetup({ playerCount: 8 }, makeDeterministicRng(seed));
}

// ─────────────────────────────────────────────
describe('isMafiaCoordinated', () => {
  test('returns false when mafia at different locations', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;
    // Force different locations
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' };
      if (c.id === mafia[1].id) return { ...c, location: 'church' };
      return c;
    });
    expect(isMafiaCoordinated(chars)).toBe(false);
  });

  test('returns true when both mafia at same location', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id || c.id === mafia[1].id) {
        return { ...c, location: 'tavern' };
      }
      return c;
    });
    expect(isMafiaCoordinated(chars)).toBe(true);
  });

  test('returns false with no mafia alive', () => {
    const state = makeSetupState();
    const chars = state.characters.map(c => {
      if (c.role === ROLES.MAFIA) return { ...c, alive: false };
      return c;
    });
    expect(isMafiaCoordinated(chars)).toBe(false);
  });

  test('returns false with only one mafia alive', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;
    const chars = state.characters.map((c, i) => {
      if (c.id === mafia[0].id) return { ...c, alive: false };
      return c;
    });
    expect(isMafiaCoordinated(chars)).toBe(false);
  });
});

// ─────────────────────────────────────────────
describe('choosePoisonTarget', () => {
  test('returns a valid character id', () => {
    const state = makeSetupState();
    const target = choosePoisonTarget(state.characters, makeDeterministicRng(1));
    expect(typeof target).toBe('string');
    const char = state.characters.find(c => c.id === target);
    expect(char).toBeDefined();
    expect(char.alive).toBe(true);
    expect(char.role).not.toBe(ROLES.MAFIA);
  });

  test('never returns a mafia member', () => {
    const state = makeSetupState();
    for (let seed = 1; seed <= 20; seed++) {
      const target = choosePoisonTarget(state.characters, makeDeterministicRng(seed));
      if (target) {
        const char = state.characters.find(c => c.id === target);
        expect(char.role).not.toBe(ROLES.MAFIA);
      }
    }
  });

  test('returns null when no eligible targets', () => {
    const state = makeSetupState();
    const chars = state.characters.map(c => ({
      ...c,
      alive: c.role === ROLES.MAFIA,
    }));
    const target = choosePoisonTarget(chars, makeDeterministicRng(1));
    expect(target).toBeNull();
  });
});

// ─────────────────────────────────────────────
describe('hasMafiaReachedTarget', () => {
  test('returns true when a mafia member is at target location', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const nonMafia = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    if (!mafia[0] || !nonMafia) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: nonMafia.location };
      return c;
    });
    expect(hasMafiaReachedTarget(chars, nonMafia.id)).toBe(true);
  });

  test('returns false when mafia not at target location', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const nonMafia = state.characters.find(
      c => c.alive && c.role !== ROLES.MAFIA &&
           mafia.every(m => m.location !== c.location)
    );
    if (!nonMafia) return;
    expect(hasMafiaReachedTarget(state.characters, nonMafia.id)).toBe(false);
  });

  test('returns false for null target', () => {
    const state = makeSetupState();
    expect(hasMafiaReachedTarget(state.characters, null)).toBe(false);
  });

  test('returns false when target is dead', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const nonMafia = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    if (!mafia[0] || !nonMafia) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: nonMafia.location };
      if (c.id === nonMafia.id) return { ...c, alive: false };
      return c;
    });
    expect(hasMafiaReachedTarget(chars, nonMafia.id)).toBe(false);
  });
});

// ─────────────────────────────────────────────
describe('getNextStep', () => {
  test('returns next step along shortest path', () => {
    // town_square → church: direct neighbor
    const step = getNextStep('town_square', 'church');
    expect(step).toBe('church');
  });

  test('returns second location for 2-hop path', () => {
    // tavern → cellar: tavern → alley → cellar
    const step = getNextStep('tavern', 'cellar');
    expect(step).toBe('alley');
  });

  test('returns null when already at destination', () => {
    expect(getNextStep('tavern', 'tavern')).toBeNull();
  });

  test('returns null for null inputs', () => {
    expect(getNextStep(null, 'tavern')).toBeNull();
    expect(getNextStep('tavern', null)).toBeNull();
  });
});

// ─────────────────────────────────────────────
describe('planMafiaDay', () => {
  test('returns a valid plan when a feasible route exists', () => {
    const state = makeSetupState();
    const plan = planMafiaDay(state, makeDeterministicRng(1));

    expect(plan.noKill).toBe(false);
    expect(plan.coordinated).toBe(false);
    expect(plan.poisoned).toBe(false);
    expect(typeof plan.meetingNode).toBe('string');
    expect(typeof plan.meetChunk).toBe('number');
    expect(plan.meetChunk).toBeGreaterThanOrEqual(1);
    expect(plan.meetChunk).toBeLessThanOrEqual(8);
    expect(typeof plan.target).toBe('string');
    expect(plan.killerMafiaId).toBeNull();
  });

  test('target is a valid non-mafia alive character', () => {
    const state = makeSetupState();
    const plan = planMafiaDay(state, makeDeterministicRng(1));

    if (plan.target) {
      const char = state.characters.find(c => c.id === plan.target);
      expect(char).toBeDefined();
      expect(char.alive).toBe(true);
      expect(char.role).not.toBe(ROLES.MAFIA);
    }
  });

  test('returns noKill: true when no feasible targets (all non-mafia dead)', () => {
    const state = makeSetupState();
    const allDeadState = {
      ...state,
      characters: state.characters.map(c =>
        c.role !== ROLES.MAFIA ? { ...c, alive: false } : c
      ),
    };
    const plan = planMafiaDay(allDeadState, makeDeterministicRng(1));
    expect(plan.noKill).toBe(true);
    expect(plan.target).toBeNull();
  });

  test('meetChunk is optimal — both mafia can reach meetingNode by that chunk', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    const { getMinimumMoves } = require('../map.js');
    const plan = planMafiaDay(state, makeDeterministicRng(1));

    if (!plan.noKill) {
      const distA = getMinimumMoves(mafia[0].location, plan.meetingNode);
      const distB = getMinimumMoves(mafia[1].location, plan.meetingNode);
      // meetChunk = max(distA, distB) + 1
      expect(plan.meetChunk).toBe(Math.max(distA, distB) + 1);
    }
  });

  test('plan is feasible: enough chunks after meeting to reach target', () => {
    const state = makeSetupState();
    const plan = planMafiaDay(state, makeDeterministicRng(1));

    if (!plan.noKill && plan.meetingNode && plan.target) {
      const { getMinimumMoves } = require('../map.js');
      const target = state.characters.find(c => c.id === plan.target);
      const distToTarget = getMinimumMoves(plan.meetingNode, target.location);
      const chunksAfterMeeting = 8 - plan.meetChunk;
      expect(distToTarget).toBeLessThanOrEqual(chunksAfterMeeting);
    }
  });

  test('produces consistent plans across multiple seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = makeSetupState(seed);
      const plan = planMafiaDay(state, makeDeterministicRng(seed));
      // Should always produce a valid plan (map is small enough)
      expect(plan.noKill).toBe(false);
      expect(plan.meetingNode).not.toBeNull();
      expect(plan.target).not.toBeNull();
    }
  });
});

// ─────────────────────────────────────────────
describe('getMafiaKillerNextMove', () => {
  test('routes toward meetingNode before coordination', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    // Force mafia[0] to town_square, set meetingNode to church (adjacent)
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' };
      if (c.id === mafia[1].id) return { ...c, location: 'docks' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      chunk: 2,
      mafiaState: {
        ...createDayMafiaState(),
        meetingNode: 'church',
        target: 'some_target',
      },
    };

    const killerChar = chars.find(c => c.id === mafia[0].id);
    const nextMove = getMafiaKillerNextMove(killerChar, testState);
    // town_square → church is adjacent, so next step is church
    expect(nextMove).toBe('church');
  });

  test('stays at meetingNode when already there (before coordination)', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'church' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      chunk: 2,
      mafiaState: {
        ...createDayMafiaState(),
        meetingNode: 'church',
        target: 'some_target',
      },
    };

    const killerChar = chars.find(c => c.id === mafia[0].id);
    const nextMove = getMafiaKillerNextMove(killerChar, testState);
    expect(nextMove).toBeNull(); // Already at meeting node
  });

  test('moves toward partner when not coordinated and no meetingNode (legacy)', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    // Force mafia to different locations
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' };
      if (c.id === mafia[1].id) return { ...c, location: 'church' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      chunk: 2,
      mafiaState: createDayMafiaState(), // meetingNode: null → legacy behavior
    };

    const killerChar = chars.find(c => c.id === mafia[0].id);
    const nextMove = getMafiaKillerNextMove(killerChar, testState);
    // Should move toward partner (church is adjacent to town_square)
    expect(nextMove).toBe('church');
  });

  test('killer routes toward target after coordination', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(
      c => c.alive && c.role !== ROLES.MAFIA && c.id !== 'player'
    );
    if (mafia.length < 2 || !target) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' };
      if (c.id === mafia[1].id) return { ...c, location: 'town_square' };
      if (c.id === target.id) return { ...c, location: 'church' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      chunk: 6,
      mafiaState: {
        coordinated: true,
        meetingNode: 'town_square',
        meetChunk: 3,
        target: target.id,
        poisoned: false,
        killerMafiaId: mafia[0].id,
        noKill: false,
        dispersed: false,
      },
    };

    const killerChar = chars.find(c => c.id === mafia[0].id);
    const nextMove = getMafiaKillerNextMove(killerChar, testState);
    // Should move toward target (church is adjacent to town_square)
    expect(nextMove).toBe('church');
  });

  test('non-killer mafia disperses away from killer and target after coordination', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(
      c => c.alive && c.role !== ROLES.MAFIA && c.id !== 'player'
    );
    if (mafia.length < 2 || !target) return;

    // Both mafia at town_square (just met), killer heading to church (target)
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' }; // killer
      if (c.id === mafia[1].id) return { ...c, location: 'town_square' }; // non-killer
      if (c.id === target.id) return { ...c, location: 'church' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      chunk: 5,
      mafiaState: {
        coordinated: true,
        meetingNode: 'town_square',
        meetChunk: 3,
        target: target.id,
        poisoned: false,
        killerMafiaId: mafia[0].id, // mafia[0] is killer
        noKill: false,
        dispersed: false,
      },
    };

    const nonKillerChar = chars.find(c => c.id === mafia[1].id);
    const nextMove = getMafiaKillerNextMove(nonKillerChar, testState);
    // Non-killer should move away from killer (town_square) and target (church)
    // Any valid adjacent location that's not church is fine
    if (nextMove !== null) {
      expect(nextMove).not.toBe('church'); // Not toward the target
      const { isAdjacent } = require('../map.js');
      expect(isAdjacent('town_square', nextMove)).toBe(true);
    }
  });

  test('returns null when already poisoned', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    if (!mafia[0] || !target) return;

    const testState = {
      ...state,
      chunk: 7,
      mafiaState: {
        coordinated: true,
        meetingNode: 'town_square',
        meetChunk: 3,
        target: target.id,
        poisoned: true,
        killerMafiaId: mafia[0].id,
        noKill: false,
        dispersed: false,
      },
    };
    const killerChar = state.characters.find(c => c.id === mafia[0].id);
    const nextMove = getMafiaKillerNextMove(killerChar, testState);
    expect(nextMove).toBeNull();
  });

  test('moves toward target when coordinated and killerMafiaId is null (legacy)', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(
      c => c.alive && c.role !== ROLES.MAFIA && c.id !== 'player'
    );
    if (mafia.length < 2 || !target) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' };
      if (c.id === mafia[1].id) return { ...c, location: 'town_square' };
      if (c.id === target.id) return { ...c, location: 'church' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      chunk: 6,
      mafiaState: {
        coordinated: true,
        target: target.id,
        poisoned: false,
        killerMafiaId: null, // legacy: no killer assigned
      },
    };

    const killerChar = chars.find(c => c.id === mafia[0].id);
    const nextMove = getMafiaKillerNextMove(killerChar, testState);
    // Should move toward target (church is adjacent to town_square)
    expect(nextMove).toBe('church');
  });
});

// ─────────────────────────────────────────────
describe('createDayMafiaState', () => {
  test('creates fresh state with expected fields', () => {
    const s = createDayMafiaState();
    expect(s.coordinated).toBe(false);
    expect(s.target).toBeNull();
    expect(s.poisoned).toBe(false);
    expect(s.killerMafiaId).toBeNull();
    expect(s.meetingNode).toBeNull();
    expect(s.meetChunk).toBeNull();
    expect(s.noKill).toBe(false);
    expect(s.dispersed).toBe(false);
  });
});

// ─────────────────────────────────────────────
describe('updateMafiaState', () => {
  test('sets coordinated=true when both mafia at meetingNode', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id || c.id === mafia[1].id) {
        return { ...c, location: 'tavern' };
      }
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: {
        ...createDayMafiaState(),
        meetingNode: 'tavern', // Both at the planned meeting node
        target: state.characters.find(c => c.alive && c.role !== ROLES.MAFIA)?.id || null,
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.coordinated).toBe(true);
    expect(updated.killerMafiaId).not.toBeNull();
  });

  test('sets coordinated=true when mafia at same location (legacy: no meetingNode)', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id || c.id === mafia[1].id) {
        return { ...c, location: 'tavern' };
      }
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: createDayMafiaState(), // meetingNode: null → legacy
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.coordinated).toBe(true);
    expect(updated.target).not.toBeNull();
  });

  test('does not set coordinated when mafia not at meetingNode', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    // Mafia at same location, but NOT at the planned meetingNode
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id || c.id === mafia[1].id) {
        return { ...c, location: 'tavern' };
      }
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: {
        ...createDayMafiaState(),
        meetingNode: 'alley', // They're at tavern, not alley
        target: 'some_target',
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.coordinated).toBe(false);
  });

  test('does not change coordinated=true once set', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    // Mafia are now at different locations after coordination
    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: 'town_square' };
      if (c.id === mafia[1].id) return { ...c, location: 'church' };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: {
        coordinated: true,
        meetingNode: 'town_square',
        meetChunk: 2,
        target: 'some_target',
        poisoned: false,
        killerMafiaId: mafia[0].id,
        noKill: false,
        dispersed: false,
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.coordinated).toBe(true);
    expect(updated.target).toBe('some_target');
  });

  test('sets poisoned=true when killer reaches target', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    if (!mafia[0] || !target) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: target.location };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: {
        coordinated: true,
        meetingNode: 'town_square',
        meetChunk: 2,
        target: target.id,
        poisoned: false,
        killerMafiaId: mafia[0].id,
        noKill: false,
        dispersed: false,
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.poisoned).toBe(true);
    expect(updated.killerMafiaId).toBe(mafia[0].id);
  });

  test('sets poisoned=true and killerMafiaId when legacy killerMafiaId is null', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    if (!mafia[0] || !target) return;

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id) return { ...c, location: target.location };
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: {
        coordinated: true,
        target: target.id,
        poisoned: false,
        killerMafiaId: null, // legacy state
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.poisoned).toBe(true);
    expect(updated.killerMafiaId).toBe(mafia[0].id);
  });

  test('does not set poisoned when killer not at target', () => {
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    const target = state.characters.find(
      c => c.alive && c.role !== ROLES.MAFIA &&
           mafia.every(m => m.location !== c.location)
    );
    if (!target) return;

    const testState = {
      ...state,
      mafiaState: {
        coordinated: true,
        meetingNode: 'town_square',
        meetChunk: 2,
        target: target.id,
        poisoned: false,
        killerMafiaId: mafia[0]?.id || null,
        noKill: false,
        dispersed: false,
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.poisoned).toBe(false);
  });

  test('coordinated becomes true when both mafia arrive at meetingNode', () => {
    // This tests the primary new behavior: plan-based coordination
    const state = makeSetupState();
    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    const nonMafia = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);

    const chars = state.characters.map(c => {
      if (c.id === mafia[0].id || c.id === mafia[1].id) {
        return { ...c, location: 'alley' };
      }
      return c;
    });
    const testState = {
      ...state,
      characters: chars,
      mafiaState: {
        coordinated: false,
        meetingNode: 'alley',
        meetChunk: 3,
        target: nonMafia?.id || null,
        killerMafiaId: null,
        poisoned: false,
        noKill: false,
        dispersed: false,
      },
    };

    const updated = updateMafiaState(testState, makeDeterministicRng(1));
    expect(updated.coordinated).toBe(true);
    expect(updated.killerMafiaId).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
describe('flagProximityAfterDeath', () => {
  test('adds proximity flags for co-located characters', () => {
    const board = {
      movementLogs: [
        { characterId: 'victim', location: 'tavern', day: 1, chunk: 3, observedBy: 'player' },
        { characterId: 'suspect_a', location: 'tavern', day: 1, chunk: 3, observedBy: 'player' },
        { characterId: 'suspect_b', location: 'town_square', day: 1, chunk: 3, observedBy: 'player' },
      ],
      confirmedRoles: {},
      contradictions: [],
      deathLog: [],
      alliances: [],
    };

    const characters = [
      { id: 'victim', name: 'Victim', location: 'tavern', alive: false },
      { id: 'suspect_a', name: 'Suspect A', location: 'tavern', alive: true },
    ];

    const updated = flagProximityAfterDeath(board, characters, 'victim', 1);
    expect(updated.proximityFlags).toHaveLength(1);
    expect(updated.proximityFlags[0].characterId).toBe('suspect_a');
    expect(updated.proximityFlags[0].victimId).toBe('victim');
  });

  test('returns original board when no co-located characters', () => {
    const board = {
      movementLogs: [
        { characterId: 'victim', location: 'tavern', day: 1, chunk: 3, observedBy: 'player' },
      ],
      confirmedRoles: {},
      contradictions: [],
      deathLog: [],
      alliances: [],
    };
    const characters = [{ id: 'victim', location: 'tavern', alive: false }];
    const updated = flagProximityAfterDeath(board, characters, 'victim', 1);
    // No proximityFlags added
    expect(updated.proximityFlags || []).toHaveLength(0);
  });

  test('does not duplicate proximity flags for same suspect', () => {
    const board = {
      movementLogs: [
        { characterId: 'victim', location: 'tavern', day: 1, chunk: 2, observedBy: 'player' },
        { characterId: 'suspect', location: 'tavern', day: 1, chunk: 2, observedBy: 'player' },
        { characterId: 'victim', location: 'tavern', day: 1, chunk: 3, observedBy: 'player' },
        { characterId: 'suspect', location: 'tavern', day: 1, chunk: 3, observedBy: 'player' },
      ],
      confirmedRoles: {},
      contradictions: [],
      deathLog: [],
      alliances: [],
    };
    const characters = [
      { id: 'victim', location: 'tavern', alive: false },
      { id: 'suspect', location: 'tavern', alive: true },
    ];
    const updated = flagProximityAfterDeath(board, characters, 'victim', 1);
    // Suspect was with victim at chunk 2 and 3, but should be flagged once (deduped by characterId)
    const suspectFlags = (updated.proximityFlags || []).filter(f => f.characterId === 'suspect');
    expect(suspectFlags.length).toBe(1);
  });
});

// ─────────────────────────────────────────────
describe('Poisoning mechanic: integration', () => {
  test('createGameWithSetup includes mafiaState', () => {
    const state = makeSetupState();
    expect(state.mafiaState).toBeDefined();
    expect(state.mafiaState.coordinated).toBe(false);
    expect(state.mafiaState.poisoned).toBe(false);
  });

  test('createGameWithSetup mafiaState has a valid plan', () => {
    const state = makeSetupState();
    expect(state.mafiaState.meetingNode).not.toBeNull();
    expect(state.mafiaState.target).not.toBeNull();
    expect(state.mafiaState.noKill).toBe(false);
  });

  test('mafiaChooseTarget returns null when mafia has not poisoned', async () => {
    const { mafiaChooseTarget } = await import('../nightResolution.js');
    const state = makeSetupState();
    const target = mafiaChooseTarget(state);
    expect(target).toBeNull();
  });

  test('mafiaChooseTarget returns target when poisoned', async () => {
    const { mafiaChooseTarget } = await import('../nightResolution.js');
    const state = makeSetupState();
    const nonMafia = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    const poisonedState = {
      ...state,
      mafiaState: {
        coordinated: true,
        target: nonMafia.id,
        poisoned: true,
        killerMafiaId: null,
      },
    };
    const target = mafiaChooseTarget(poisonedState);
    expect(target).toBe(nonMafia.id);
  });
});
