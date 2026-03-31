import { describe, it, expect } from 'vitest';
import {
  WIN_STATES,
  LOSE_REASONS,
  countAliveByTeam,
  isPlayerAlive,
  allMafiaEliminated,
  hasMafiaParity,
  checkWinCondition,
  applyVoteResult,
  formAlliance,
} from '../winCondition.js';
import { createInitialGameState, PHASES, MAX_DAYS } from '../gameState.js';
import { ROLES } from '../roles.js';
import { mafiaChooseTarget } from '../nightResolution.js';

function makeState(overrides = {}) {
  return { ...createInitialGameState(), ...overrides };
}

describe('countAliveByTeam', () => {
  it('counts correctly at game start', () => {
    const state = createInitialGameState();
    const { mafiaCount, innocentCount } = countAliveByTeam(state.characters);
    expect(mafiaCount).toBe(2);
    expect(innocentCount).toBe(10); // 1 inspector + 9 other innocents
  });
});

describe('isPlayerAlive', () => {
  it('returns true when player is alive', () => {
    const state = createInitialGameState();
    expect(isPlayerAlive(state.characters)).toBe(true);
  });

  it('returns false when player is dead', () => {
    const state = createInitialGameState();
    const deadChars = state.characters.map(c =>
      c.id === 'player' ? { ...c, alive: false } : c
    );
    expect(isPlayerAlive(deadChars)).toBe(false);
  });
});

describe('allMafiaEliminated', () => {
  it('returns false when mafia alive', () => {
    const state = createInitialGameState();
    expect(allMafiaEliminated(state.characters)).toBe(false);
  });

  it('returns true when all mafia dead', () => {
    const state = createInitialGameState();
    const chars = state.characters.map(c =>
      c.role === ROLES.MAFIA ? { ...c, alive: false } : c
    );
    expect(allMafiaEliminated(chars)).toBe(true);
  });
});

describe('hasMafiaParity', () => {
  it('returns false at game start (2 mafia vs 10 innocents)', () => {
    const state = createInitialGameState();
    expect(hasMafiaParity(state.characters)).toBe(false);
  });

  it('returns true when mafia equals innocents', () => {
    const state = createInitialGameState();
    // Kill all but 2 innocents
    let chars = state.characters.map(c => {
      if (c.role !== ROLES.MAFIA && c.id !== 'player') {
        // Kill all non-mafia, non-player to leave only 1 innocent (player) + 2 mafia
        return { ...c, alive: false };
      }
      return c;
    });
    // Now: 2 mafia alive, 1 innocent (player) alive => parity (2 >= 1)
    expect(hasMafiaParity(chars)).toBe(true);
  });

  it('returns true when mafia outnumbers innocents', () => {
    const chars = [
      { id: 'player', role: ROLES.INSPECTOR, alive: true },
      { id: 'm1', role: ROLES.MAFIA, alive: true },
      { id: 'm2', role: ROLES.MAFIA, alive: true },
      { id: 'c1', role: ROLES.CITIZEN, alive: false },
    ];
    expect(hasMafiaParity(chars)).toBe(true);
  });
});

describe('checkWinCondition', () => {
  it('returns IN_PROGRESS at game start', () => {
    const state = createInitialGameState();
    const result = checkWinCondition(state);
    expect(result.state).toBe(WIN_STATES.IN_PROGRESS);
  });

  it('returns PLAYER_WINS when all mafia eliminated', () => {
    const state = createInitialGameState();
    const chars = state.characters.map(c =>
      c.role === ROLES.MAFIA ? { ...c, alive: false } : c
    );
    const result = checkWinCondition({ ...state, characters: chars });
    expect(result.state).toBe(WIN_STATES.PLAYER_WINS);
  });

  it('returns MAFIA_WINS when player is killed', () => {
    const state = createInitialGameState();
    const chars = state.characters.map(c =>
      c.id === 'player' ? { ...c, alive: false } : c
    );
    const result = checkWinCondition({ ...state, characters: chars });
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.PLAYER_KILLED);
  });

  it('returns MAFIA_WINS when mafia reaches parity', () => {
    const state = createInitialGameState();
    const chars = state.characters.map(c => {
      if (c.role !== ROLES.MAFIA && c.id !== 'player') return { ...c, alive: false };
      return c;
    });
    const result = checkWinCondition({ ...state, characters: chars });
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.MAFIA_PARITY);
  });

  it('returns MAFIA_WINS on timeout', () => {
    const state = createInitialGameState();
    const result = checkWinCondition({ ...state, day: MAX_DAYS + 1 });
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.TIME_OUT);
  });
});

describe('applyVoteResult', () => {
  it('marks character as dead', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    const newState = applyVoteResult(state, target.id);
    const dead = newState.characters.find(c => c.id === target.id);
    expect(dead.alive).toBe(false);
  });

  it('reveals role in evidence board', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    const newState = applyVoteResult(state, target.id);
    expect(newState.evidenceBoard.confirmedRoles[target.id]).toBe(target.role);
  });

  it('logs death with vote cause', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    const newState = applyVoteResult(state, target.id);
    const deathEntry = newState.evidenceBoard.deathLog.find(d => d.characterId === target.id);
    expect(deathEntry).not.toBeUndefined();
    expect(deathEntry.cause).toBe('vote');
    expect(deathEntry.revealedRole).toBe(target.role);
  });

  it('throws if character already dead', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    const stateAfterVote = applyVoteResult(state, target.id);
    expect(() => applyVoteResult(stateAfterVote, target.id)).toThrow();
  });
});

describe('formAlliance', () => {
  it('marks character as allied', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const newState = formAlliance(state, citizen.id);
    const updated = newState.characters.find(c => c.id === citizen.id);
    expect(updated.alliedWithInspector).toBe(true);
  });

  it('adds to evidence board alliances', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const newState = formAlliance(state, citizen.id);
    expect(newState.evidenceBoard.alliances).toHaveLength(1);
    expect(newState.evidenceBoard.alliances[0].characterId).toBe(citizen.id);
    expect(newState.evidenceBoard.alliances[0].role).toBe(ROLES.CITIZEN);
  });

  it('reveals character role on evidence board', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const newState = formAlliance(state, citizen.id);
    expect(newState.evidenceBoard.confirmedRoles[citizen.id]).toBe(ROLES.CITIZEN);
  });

  it('throws for dead character', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const deadState = {
      ...state,
      characters: state.characters.map(c =>
        c.id === citizen.id ? { ...c, alive: false } : c
      ),
    };
    expect(() => formAlliance(deadState, citizen.id)).toThrow();
  });

  it('formAlliance with innocent: mafiaKnowsInspector stays false', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    const newState = formAlliance(state, citizen.id);
    expect(newState.mafiaKnowsInspector).toBeFalsy();
  });

  it('formAlliance with mafia: game over immediately (inspector revealed)', () => {
    const state = createInitialGameState();
    const mafia = state.characters.find(c => c.role === ROLES.MAFIA);
    const newState = formAlliance(state, mafia.id);
    expect(newState.gameOver).toBe(true);
    expect(newState.winner).toBe('mafia');
    expect(newState.winReason).toBe('inspector_revealed');
  });

  it('formAlliance with mafia: does NOT set alliedWithInspector', () => {
    const state = createInitialGameState();
    const mafia = state.characters.find(c => c.role === ROLES.MAFIA);
    const newState = formAlliance(state, mafia.id);
    const mafiaChar = newState.characters.find(c => c.id === mafia.id);
    // characters array unchanged since game ended immediately
    expect(mafiaChar?.alliedWithInspector).toBeFalsy();
  });

  it('formAlliance with innocent: dumps witnessed to allyObservations', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === ROLES.CITIZEN);
    // Give the citizen some witnessed events
    const stateWithWitness = {
      ...state,
      evidenceBoard: { ...state.evidenceBoard, allyObservations: [] },
      characters: state.characters.map(c =>
        c.id === citizen.id
          ? { ...c, knowledgeState: { witnessed: [{ type: 'saw_character', subjectId: 'brad_barber', subjectName: 'Brad the Barber', location: 'tavern', day: 1, chunk: 2 }] } }
          : c
      ),
    };
    const newState = formAlliance(stateWithWitness, citizen.id);
    expect(newState.evidenceBoard.allyObservations.length).toBeGreaterThan(0);
    expect(newState.evidenceBoard.allyObservations[0].type).toBe('ally_observation');
    expect(newState.evidenceBoard.allyObservations[0].allyId).toBe(citizen.id);
  });

  it('mafiaChooseTarget targets player when mafiaKnowsInspector is true', () => {
    const state = { ...createInitialGameState(), mafiaKnowsInspector: true };
    const target = mafiaChooseTarget(state);
    expect(target).toBe('player');
  });
});

describe('checkWinCondition maxDays', () => {
  it('maxDays: 3 → game over on day 4', () => {
    const state = { ...createInitialGameState(), day: 4, maxDays: 3 };
    const result = checkWinCondition(state);
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.TIME_OUT);
  });

  it('maxDays: 7 → still in progress on day 5', () => {
    const state = { ...createInitialGameState(), day: 5, maxDays: 7 };
    const result = checkWinCondition(state);
    expect(result.state).toBe(WIN_STATES.IN_PROGRESS);
  });

  it('falls back to MAX_DAYS when maxDays not set', () => {
    const state = createInitialGameState();
    const resultAtLimit = checkWinCondition({ ...state, day: MAX_DAYS + 1 });
    expect(resultAtLimit.state).toBe(WIN_STATES.MAFIA_WINS);
    const resultBefore = checkWinCondition({ ...state, day: MAX_DAYS });
    expect(resultBefore.state).toBe(WIN_STATES.IN_PROGRESS);
  });
});
