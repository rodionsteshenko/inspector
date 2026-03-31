import { describe, it, expect } from 'vitest';
import {
  validateMove,
  moveCharacter,
  movePlayer,
  generateLocationObservation,
  generateInteractionObservation,
  logMovementToEvidence,
  MOVE_ERRORS,
} from '../movement.js';
import { createInitialGameState, PHASES } from '../gameState.js';

function makeState(overrides = {}) {
  const base = createInitialGameState();
  // Force player to town_square and clear tavern of NPCs for predictable tests
  const characters = base.characters.map(c => {
    if (c.id === 'player') return { ...c, location: 'town_square' };
    // Move NPCs away from tavern so the player can always move there (capacity 4)
    if (c.location === 'tavern') return { ...c, location: 'docks' };
    return c;
  });
  return { ...base, ...overrides, characters, playerLocation: 'town_square' };
}

describe('validateMove', () => {
  it('allows movement to adjacent location', () => {
    const state = makeState();
    const result = validateMove(state, 'player', 'tavern');
    expect(result.valid).toBe(true);
  });

  it('rejects movement to non-adjacent location', () => {
    const state = makeState();
    const result = validateMove(state, 'player', 'cellar');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(MOVE_ERRORS.NOT_ADJACENT);
  });

  it('rejects movement to invalid location', () => {
    const state = makeState();
    const result = validateMove(state, 'player', 'nowhere');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(MOVE_ERRORS.INVALID_LOCATION);
  });

  it('rejects movement for dead character', () => {
    const state = makeState();
    const deadState = {
      ...state,
      characters: state.characters.map(c =>
        c.id === 'player' ? { ...c, alive: false } : c
      ),
    };
    const result = validateMove(deadState, 'player', 'tavern');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(MOVE_ERRORS.PLAYER_DEAD);
  });

  it('rejects movement to same location', () => {
    const state = makeState();
    const result = validateMove(state, 'player', 'town_square');
    expect(result.valid).toBe(false);
  });
});

describe('moveCharacter', () => {
  it('moves character to adjacent location', () => {
    const state = makeState();
    const newState = moveCharacter(state, 'player', 'tavern');
    const player = newState.characters.find(c => c.id === 'player');
    expect(player.location).toBe('tavern');
  });

  it('updates movementLog with new entry', () => {
    const state = makeState();
    const newState = moveCharacter(state, 'player', 'tavern');
    const player = newState.characters.find(c => c.id === 'player');
    const lastLog = player.movementLog[player.movementLog.length - 1];
    expect(lastLog.location).toBe('tavern');
    expect(lastLog.day).toBe(state.day);
    expect(lastLog.chunk).toBe(state.chunk);
  });

  it('updates playerLocation when moving player', () => {
    const state = makeState();
    const newState = moveCharacter(state, 'player', 'tavern');
    expect(newState.playerLocation).toBe('tavern');
  });

  it('throws for invalid move', () => {
    const state = makeState();
    expect(() => moveCharacter(state, 'player', 'cellar')).toThrow();
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const originalLocation = state.characters.find(c => c.id === 'player').location;
    moveCharacter(state, 'player', 'tavern');
    const player = state.characters.find(c => c.id === 'player');
    expect(player.location).toBe(originalLocation);
  });
});

describe('movePlayer', () => {
  it('throws if not in day phase', () => {
    const state = { ...makeState(), phase: PHASES.NIGHT };
    expect(() => movePlayer(state, 'tavern')).toThrow();
  });

  it('moves player during day phase', () => {
    const state = makeState({ phase: PHASES.DAY });
    const newState = movePlayer(state, 'tavern');
    expect(newState.playerLocation).toBe('tavern');
  });
});

describe('generateLocationObservation', () => {
  it('returns observation with present characters', () => {
    const state = makeState();
    // Put a character at town_square
    const updatedChars = state.characters.map(c =>
      c.id === state.characters[1].id ? { ...c, location: 'town_square' } : c
    );
    const stateWithChars = { ...state, characters: updatedChars };
    const obs = generateLocationObservation(stateWithChars, 'player');
    expect(obs).not.toBeNull();
    expect(obs.observerId).toBe('player');
    expect(obs.location).toBe('town_square');
    expect(obs.presentCharacterIds).not.toContain('player');
  });
});

describe('moveCharacter witness logging', () => {
  it('mover witnesses everyone already at destination', () => {
    const state = makeState();
    // Place an NPC at tavern (destination)
    const npc = state.characters.find(c => c.id !== 'player');
    const stateWithNpc = {
      ...state,
      characters: state.characters.map(c =>
        c.id === npc.id ? { ...c, location: 'tavern' } : c
      ),
    };
    const newState = moveCharacter(stateWithNpc, 'player', 'tavern');
    const player = newState.characters.find(c => c.id === 'player');
    const witnessed = player.knowledgeState?.witnessed || [];
    expect(witnessed.some(w => w.subjectId === npc.id)).toBe(true);
  });

  it('destination characters witness the mover arriving', () => {
    const state = makeState();
    const npc = state.characters.find(c => c.id !== 'player');
    const stateWithNpc = {
      ...state,
      characters: state.characters.map(c =>
        c.id === npc.id ? { ...c, location: 'tavern' } : c
      ),
    };
    const newState = moveCharacter(stateWithNpc, 'player', 'tavern');
    const updatedNpc = newState.characters.find(c => c.id === npc.id);
    const witnessed = updatedNpc.knowledgeState?.witnessed || [];
    expect(witnessed.some(w => w.subjectId === 'player')).toBe(true);
  });

  it('moving to empty location adds no witnessed entries for mover', () => {
    const state = makeState();
    // Ensure tavern is empty (makeState already clears it)
    const newState = moveCharacter(state, 'player', 'tavern');
    const player = newState.characters.find(c => c.id === 'player');
    const witnessed = player.knowledgeState?.witnessed || [];
    expect(witnessed.length).toBe(0);
  });

  it('witness entries have correct structure', () => {
    const state = makeState();
    const npc = state.characters.find(c => c.id !== 'player');
    const stateWithNpc = {
      ...state,
      characters: state.characters.map(c =>
        c.id === npc.id ? { ...c, location: 'tavern' } : c
      ),
    };
    const newState = moveCharacter(stateWithNpc, 'player', 'tavern');
    const player = newState.characters.find(c => c.id === 'player');
    const entry = player.knowledgeState.witnessed[0];
    expect(entry).toMatchObject({
      type: 'saw_character',
      subjectId: npc.id,
      subjectName: npc.name,
      location: 'tavern',
      day: state.day,
      chunk: state.chunk,
    });
  });
});

describe('logMovementToEvidence', () => {
  it('adds a movement log entry', () => {
    const board = { movementLogs: [] };
    const updated = logMovementToEvidence(board, 'brad_barber', 'tavern', 1, 2, 'player');
    expect(updated.movementLogs).toHaveLength(1);
    expect(updated.movementLogs[0].characterId).toBe('brad_barber');
    expect(updated.movementLogs[0].location).toBe('tavern');
  });

  it('does not mutate original board', () => {
    const board = { movementLogs: [] };
    logMovementToEvidence(board, 'brad', 'tavern', 1, 1, 'player');
    expect(board.movementLogs).toHaveLength(0);
  });
});
