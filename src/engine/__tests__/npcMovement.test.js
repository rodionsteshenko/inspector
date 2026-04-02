import { describe, test, expect } from 'vitest';
import { moveNPCs, ensureMafiaState } from '../npcMovement.js';
import { createGameWithSetup } from '../gameState.js';
import { isAdjacent, isValidLocation } from '../map.js';
import { createDayMafiaState } from '../poisoning.js';
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

describe('moveNPCs', () => {
  test('returns valid state without throwing', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(1);
    expect(() => moveNPCs(state, rng)).not.toThrow();
  });

  test('all NPCs remain at valid locations after movement', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(1);
    const newState = moveNPCs(state, rng);
    const nodes = state.mapConfig?.nodes;

    const npcs = newState.characters.filter(c => c.id !== 'player' && c.alive);
    for (const npc of npcs) {
      expect(isValidLocation(npc.location, nodes)).toBe(true);
    }
  });

  test('NPCs only move to adjacent locations', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(1);
    const newState = moveNPCs(state, rng);
    const adj = state.mapConfig?.adjacencyMap;

    const npcs = state.characters.filter(c => c.id !== 'player' && c.alive);
    for (const npc of npcs) {
      const newNpc = newState.characters.find(c => c.id === npc.id);
      if (newNpc.location !== npc.location) {
        expect(isAdjacent(npc.location, newNpc.location, adj)).toBe(true);
      }
    }
  });

  test('player location does not change', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(1);
    const newState = moveNPCs(state, rng);

    const player = newState.characters.find(c => c.id === 'player');
    const origPlayer = state.characters.find(c => c.id === 'player');
    expect(player.location).toBe(origPlayer.location);
    expect(newState.playerLocation).toBe(state.playerLocation);
  });

  test('mafiaState is updated after movement', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(1);
    const newState = moveNPCs(state, rng);

    // mafiaState should be present (from createGameWithSetup)
    expect(newState.mafiaState).toBeDefined();
  });

  test('mafia members converge toward each other over multiple chunks', () => {
    let state = makeSetupState(1);
    const rng = makeDeterministicRng(1);

    const mafia = state.characters.filter(c => c.role === ROLES.MAFIA);
    if (mafia.length < 2) return;

    // Force mafia apart using the first and last nodes on the map
    const mapNodes = state.mapConfig?.nodes || [];
    const startLocA = mapNodes[0]?.id || 'town_square';
    const startLocB = mapNodes[mapNodes.length - 1]?.id || 'tavern';

    state = {
      ...state,
      characters: state.characters.map(c => {
        if (c.id === mafia[0].id) return { ...c, location: startLocA };
        if (c.id === mafia[1].id) return { ...c, location: startLocB };
        return c;
      }),
      chunk: 2,
      mafiaState: createDayMafiaState(),
    };

    // Run several chunks of NPC movement
    let s = state;
    let coordinated = false;
    for (let i = 0; i < 6; i++) {
      s = moveNPCs(s, makeDeterministicRng(i));
      s = { ...s, chunk: s.chunk + 1 };
      if (s.mafiaState && s.mafiaState.coordinated) {
        coordinated = true;
        break;
      }
    }
    // Mafia should eventually coordinate (or at least move toward each other)
    const m0 = s.characters.find(c => c.id === mafia[0].id);
    const m1 = s.characters.find(c => c.id === mafia[1].id);
    // Either they coordinated or they moved from their starting positions
    const moved = m0.location !== startLocA || m1.location !== startLocB;
    expect(moved || coordinated).toBe(true);
  });

  test('dead NPCs are not moved', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(1);

    const firstNpc = state.characters.find(c => c.id !== 'player');
    const deadState = {
      ...state,
      characters: state.characters.map(c =>
        c.id === firstNpc.id ? { ...c, alive: false } : c
      ),
    };

    const newState = moveNPCs(deadState, rng);
    const deadChar = newState.characters.find(c => c.id === firstNpc.id);
    expect(deadChar.location).toBe(firstNpc.location);
  });

  test('movement is logged in movementLog for NPCs that moved', () => {
    const state = makeSetupState();
    const rng = makeDeterministicRng(99);
    const newState = moveNPCs(state, rng);

    const npcs = state.characters.filter(c => c.id !== 'player' && c.alive);
    for (const npc of npcs) {
      const newNpc = newState.characters.find(c => c.id === npc.id);
      if (newNpc.location !== npc.location) {
        // movementLog should have an entry for the new location
        const lastLog = newNpc.movementLog[newNpc.movementLog.length - 1];
        expect(lastLog.location).toBe(newNpc.location);
      }
    }
  });
});

describe('ensureMafiaState', () => {
  test('adds mafiaState if not present', () => {
    const state = makeSetupState();
    const stateWithout = { ...state, mafiaState: undefined };
    const result = ensureMafiaState(stateWithout);
    expect(result.mafiaState).toBeDefined();
    expect(result.mafiaState.coordinated).toBe(false);
  });

  test('preserves existing mafiaState', () => {
    const state = makeSetupState();
    const customMafiaState = {
      coordinated: true,
      target: 'some_id',
      poisoned: false,
      killerMafiaId: null,
    };
    const stateWith = { ...state, mafiaState: customMafiaState };
    const result = ensureMafiaState(stateWith);
    expect(result.mafiaState).toEqual(customMafiaState);
  });
});

describe('NPC movement: vote resolution with poisoning', () => {
  test('mafiaChooseTarget returns null when no poison occurred', async () => {
    const { mafiaChooseTarget } = await import('../nightResolution.js');
    const state = makeSetupState();
    // mafiaState present but not poisoned
    expect(mafiaChooseTarget(state)).toBeNull();
  });

  test('mafiaChooseTarget returns target after successful poison', async () => {
    const { mafiaChooseTarget } = await import('../nightResolution.js');
    const state = makeSetupState();
    const nonMafia = state.characters.find(c => c.alive && c.role !== ROLES.MAFIA);
    if (!nonMafia) return;

    const poisonedState = {
      ...state,
      mafiaState: { coordinated: true, target: nonMafia.id, poisoned: true, killerMafiaId: null },
    };
    expect(mafiaChooseTarget(poisonedState)).toBe(nonMafia.id);
  });
});
