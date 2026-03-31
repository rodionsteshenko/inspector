import { describe, it, expect } from 'vitest';
import { generateTestimony, generateAllTestimony } from '../testimony.js';
import { createInitialGameState } from '../gameState.js';
import { ROLES } from '../roles.js';

function makeDeterministicRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

describe('generateTestimony for innocent character', () => {
  it('produces no lies in locationClaims', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);

    // Give citizen a movement log
    const charWithMovement = {
      ...citizen,
      movementLog: [
        { day: 1, chunk: 2, location: 'tavern' },
        { day: 1, chunk: 4, location: 'market' },
      ],
    };

    const testimony = generateTestimony(charWithMovement, state.characters, 1, makeDeterministicRng(1));
    expect(testimony.locationClaims.every(c => c.isLie === false)).toBe(true);
    expect(testimony.locationClaims.every(c => c.claimedLocation === c.actualLocation)).toBe(true);
  });

  it('produces no suspicions', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const testimony = generateTestimony(citizen, state.characters, 1, makeDeterministicRng(1));
    expect(testimony.suspicions).toHaveLength(0);
  });

  it('observations come from witnessed events', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const charWithWitness = {
      ...citizen,
      knowledgeState: {
        witnessed: [
          { type: 'saw_character', subjectId: 'brad_barber', subjectName: 'Brad the Barber', location: 'tavern', day: 1, chunk: 2 },
        ],
      },
    };
    const testimony = generateTestimony(charWithWitness, state.characters, 1, makeDeterministicRng(1));
    expect(testimony.observations).toHaveLength(1);
    expect(testimony.observations[0].isTrue).toBe(true);
    expect(testimony.observations[0].subjectId).toBe('brad_barber');
  });
});

describe('generateTestimony for mafia character', () => {
  it('produces at least 1 lie when movement log has entries', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const mafia = state.characters.find(c => c.role === ROLES.MAFIA);

    const mafiaWithMovement = {
      ...mafia,
      movementLog: [
        { day: 1, chunk: 2, location: 'tavern' },
        { day: 1, chunk: 4, location: 'alley' },
        { day: 1, chunk: 6, location: 'market' },
      ],
    };

    const testimony = generateTestimony(mafiaWithMovement, state.characters, 1, makeDeterministicRng(42));
    const lies = testimony.locationClaims.filter(c => c.isLie);
    expect(lies.length).toBeGreaterThanOrEqual(1);
    expect(lies.every(c => c.claimedLocation !== c.actualLocation)).toBe(true);
  });

  it('includes a deflection suspicion pointing at an innocent', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const mafia = state.characters.find(c => c.role === ROLES.MAFIA);
    const testimony = generateTestimony(mafia, state.characters, 1, makeDeterministicRng(42));
    expect(testimony.suspicions).toHaveLength(1);
    // Target should be an innocent (not mafia, not player)
    const target = state.characters.find(c => c.id === testimony.suspicions[0].targetId);
    expect(target).toBeDefined();
    expect(target.role).not.toBe(ROLES.MAFIA);
    expect(target.id).not.toBe('player');
  });
});

describe('generateAllTestimony', () => {
  it('attaches testimony to all non-player characters', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const newState = generateAllTestimony(state, 1, makeDeterministicRng(1));
    const npcs = newState.characters.filter(c => c.id !== 'player');
    expect(npcs.every(c => c.testimony !== undefined)).toBe(true);
  });

  it('does not attach testimony to player', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const newState = generateAllTestimony(state, 1, makeDeterministicRng(1));
    const player = newState.characters.find(c => c.id === 'player');
    expect(player.testimony).toBeUndefined();
  });

  it('does not mutate original state', () => {
    const state = createInitialGameState(makeDeterministicRng(1));
    const originalNpc = state.characters.find(c => c.id !== 'player');
    generateAllTestimony(state, 1, makeDeterministicRng(1));
    expect(originalNpc.testimony).toBeUndefined();
  });
});
