// Integration tests: full day cycle, win/lose conditions, evidence board population
import { describe, test, expect } from 'vitest';
import {
  createInitialGameState, PHASES,
  advanceChunk, transitionToNight, transitionToDay,
  recordConversation, setNightAction,
} from '../gameState.js';
import {
  movePlayer, generateLocationObservation, logMovementToEvidence,
} from '../movement.js';
import {
  resolveNight, mafiaChooseTarget, doctorChooseTarget,
} from '../nightResolution.js';
import {
  checkWinCondition, applyVoteResult, WIN_STATES, LOSE_REASONS,
} from '../winCondition.js';
import { getAdjacentLocations } from '../map.js';

// Deterministic RNG using a simple LCG so tests produce consistent role assignments
function makeDeterministicRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeState(seed = 1) {
  return createInitialGameState(makeDeterministicRng(seed));
}

// ─────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────
describe('Integration: initial state', () => {
  test('game starts in day phase', () => {
    const s = makeState();
    expect(s.phase).toBe(PHASES.DAY);
    expect(s.day).toBe(1);
    expect(s.chunk).toBe(1);
  });

  test('12 characters present (player + 11 NPCs)', () => {
    const s = makeState();
    expect(s.characters).toHaveLength(12);
  });

  test('exactly 2 mafia among NPCs', () => {
    const s = makeState();
    const mafia = s.characters.filter(c => c.role === 'mafia');
    expect(mafia).toHaveLength(2);
  });

  test('conversation slots reset at 3', () => {
    const s = makeState();
    expect(s.conversationsUsed).toBe(0);
    expect(s.conversationsAvailable).toBe(3);
  });
});

// ─────────────────────────────────────────────
// Movement
// ─────────────────────────────────────────────
describe('Integration: movement', () => {
  test('player can move to adjacent location', () => {
    const s = makeState();
    const adjacent = getAdjacentLocations(s.playerLocation);
    expect(adjacent.length).toBeGreaterThan(0);

    const s2 = movePlayer(s, adjacent[0]);
    expect(s2.playerLocation).toBe(adjacent[0]);
  });

  test('movement advances chunk when advanceChunk is called', () => {
    let s = makeState();
    const adj = getAdjacentLocations(s.playerLocation);
    s = movePlayer(s, adj[0]);
    s = advanceChunk(s);
    expect(s.chunk).toBe(2);
  });

  test('moving to non-adjacent location throws', () => {
    const s = makeState();
    // Find a location that is NOT adjacent
    const allIds = ['town_square', 'church', 'docks', 'market', 'tavern', 'library', 'alley', 'cellar'];
    const adjacent = getAdjacentLocations(s.playerLocation);
    const nonAdjacent = allIds.find(id => !adjacent.includes(id) && id !== s.playerLocation);
    if (nonAdjacent) {
      expect(() => movePlayer(s, nonAdjacent)).toThrow();
    }
  });
});

// ─────────────────────────────────────────────
// Observe action / evidence board
// ─────────────────────────────────────────────
describe('Integration: observe & evidence board', () => {
  test('generateLocationObservation returns present characters', () => {
    const s = makeState();
    const obs = generateLocationObservation(s, 'player');
    expect(obs).not.toBeNull();
    expect(obs.location).toBe(s.playerLocation);
    expect(Array.isArray(obs.presentCharacterIds)).toBe(true);
  });

  test('logMovementToEvidence populates movement logs', () => {
    const s = makeState();
    const obs = generateLocationObservation(s, 'player');
    let board = s.evidenceBoard;
    for (const charId of obs.presentCharacterIds) {
      board = logMovementToEvidence(board, charId, obs.location, obs.day, obs.chunk, 'player');
    }
    expect(board.movementLogs.length).toBe(obs.presentCharacterIds.length);
    if (obs.presentCharacterIds.length > 0) {
      expect(board.movementLogs[0].location).toBe(obs.location);
      expect(board.movementLogs[0].day).toBe(s.day);
    }
  });

  test('observation entry does not mutate original board', () => {
    const s = makeState();
    const obs = generateLocationObservation(s, 'player');
    if (obs.presentCharacterIds.length > 0) {
      const before = s.evidenceBoard.movementLogs.length;
      logMovementToEvidence(s.evidenceBoard, obs.presentCharacterIds[0], obs.location, 1, 1, 'player');
      expect(s.evidenceBoard.movementLogs.length).toBe(before);
    }
  });
});

// ─────────────────────────────────────────────
// Conversation slot tracking
// ─────────────────────────────────────────────
describe('Integration: conversations', () => {
  test('recordConversation increments counter', () => {
    let s = makeState();
    s = recordConversation(s);
    expect(s.conversationsUsed).toBe(1);
  });

  test('throws when no slots remain', () => {
    let s = makeState();
    s = recordConversation(s);
    s = recordConversation(s);
    s = recordConversation(s);
    expect(() => recordConversation(s)).toThrow();
  });

  test('conversation slots reset after transitionToDay', () => {
    let s = makeState();
    s = recordConversation(s);
    // Burn to night
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    s = transitionToNight(s);
    s = resolveNight(s);     // → dawn
    s = transitionToDay(s);  // → day 2
    expect(s.conversationsUsed).toBe(0);
    expect(s.conversationsAvailable).toBe(3);
  });
});

// ─────────────────────────────────────────────
// Full day cycle
// ─────────────────────────────────────────────
describe('Integration: full day cycle', () => {
  test('day → night after 8 chunk advances', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    expect(s.phase).toBe(PHASES.NIGHT);
  });

  test('night → dawn → day 2 (skip everything)', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    // Already in NIGHT after advanceChunk loop
    expect(s.phase).toBe(PHASES.NIGHT);

    s = resolveNight(s);           // no night actions set — no_kill, no investigation
    expect(s.phase).toBe(PHASES.DAWN);
    expect(s.lastNightResult).not.toBeNull();

    s = transitionToDay(s);
    expect(s.phase).toBe(PHASES.DAY);
    expect(s.day).toBe(2);
  });

  test('move → observe → talk → vote completes without error', () => {
    let s = makeState();

    // Move
    const adj = getAdjacentLocations(s.playerLocation);
    s = movePlayer(s, adj[0]);
    s = advanceChunk(s);

    // Observe
    const obs = generateLocationObservation(s, 'player');
    let board = s.evidenceBoard;
    for (const id of obs.presentCharacterIds) {
      board = logMovementToEvidence(board, id, obs.location, s.day, s.chunk, 'player');
    }
    s = { ...s, evidenceBoard: board };
    s = advanceChunk(s);

    // Talk (record a conversation)
    s = recordConversation(s);
    s = advanceChunk(s);

    // Burn remaining chunks to night
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    expect(s.phase).toBe(PHASES.NIGHT);
  });

  test('NPC night actions are determined correctly', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    // Already in NIGHT

    const mafiaTarget = mafiaChooseTarget(s);
    const doctorTarget = doctorChooseTarget(s);

    expect(mafiaTarget).not.toBeNull();   // mafia always picks someone
    // doctor may or may not pick (depends on RNG)
    expect(typeof mafiaTarget).toBe('string');
  });
});

// ─────────────────────────────────────────────
// Night resolution
// ─────────────────────────────────────────────
describe('Integration: night resolution', () => {
  test('investigation reveals exact role, updates evidence board', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    // Already in NIGHT

    const target = s.characters.find(c => c.alive && c.id !== 'player');
    s = setNightAction(s, 'inspectorTarget', target.id);
    s = resolveNight(s);

    expect(s.lastNightResult.investigationResult).not.toBeNull();
    expect(s.lastNightResult.investigationResult.role).toBe(target.role);
    expect(s.evidenceBoard.confirmedRoles[target.id]).toBe(target.role);
  });

  test('mafia kill marks victim dead and logs death', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    // Already in NIGHT

    const mafiaTarget = mafiaChooseTarget(s);
    if (mafiaTarget === 'player') return; // skip — no predictable test here

    s = setNightAction(s, 'mafiaTarget', mafiaTarget);
    // No doctor protection
    s = resolveNight(s);

    const victim = s.characters.find(c => c.id === mafiaTarget);
    if (s.lastNightResult.killResult.type === 'killed') {
      expect(victim.alive).toBe(false);
      const logged = s.evidenceBoard.deathLog.find(d => d.characterId === mafiaTarget);
      expect(logged).toBeDefined();
    }
  });

  test('doctor protection saves the target', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    // Already in NIGHT

    const mafiaTarget = mafiaChooseTarget(s);
    if (!mafiaTarget) return;

    // Doctor protects same target
    s = setNightAction(s, 'mafiaTarget', mafiaTarget);
    s = setNightAction(s, 'doctorTarget', mafiaTarget);
    s = resolveNight(s);

    const target = s.characters.find(c => c.id === mafiaTarget);
    expect(target.alive).toBe(true);
    expect(s.lastNightResult.killResult.type).toBe('saved');
  });
});

// ─────────────────────────────────────────────
// Vote mechanic
// ─────────────────────────────────────────────
describe('Integration: vote mechanic', () => {
  test('applyVoteResult eliminates character, reveals role in evidence board', () => {
    let s = makeState();
    const target = s.characters.find(c => c.alive && c.id !== 'player');

    s = applyVoteResult(s, target.id);

    const eliminated = s.characters.find(c => c.id === target.id);
    expect(eliminated.alive).toBe(false);
    expect(s.evidenceBoard.confirmedRoles[target.id]).toBe(target.role);

    const death = s.evidenceBoard.deathLog.find(d => d.characterId === target.id);
    expect(death).toBeDefined();
    expect(death.cause).toBe('vote');
    expect(death.revealedRole).toBe(target.role);
  });

  test('eliminating already-dead character throws', () => {
    let s = makeState();
    const target = s.characters.find(c => c.alive && c.id !== 'player');
    s = applyVoteResult(s, target.id);
    expect(() => applyVoteResult(s, target.id)).toThrow();
  });
});

// ─────────────────────────────────────────────
// Win / lose conditions
// ─────────────────────────────────────────────
describe('Integration: win/lose conditions', () => {
  test('player wins when all mafia eliminated via vote', () => {
    let s = makeState();
    const mafiaChars = s.characters.filter(c => c.role === 'mafia');
    for (const m of mafiaChars) {
      s = applyVoteResult(s, m.id);
    }
    const result = checkWinCondition(s);
    expect(result.state).toBe(WIN_STATES.PLAYER_WINS);
  });

  test('mafia wins when player is killed at night', () => {
    let s = makeState();
    while (s.phase === PHASES.DAY) s = advanceChunk(s);
    // Already in NIGHT
    s = setNightAction(s, 'mafiaTarget', 'player');
    s = resolveNight(s);

    const result = checkWinCondition(s);
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.PLAYER_KILLED);
  });

  test('mafia wins at parity', () => {
    let s = makeState();
    const mafia = s.characters.filter(c => c.role === 'mafia');
    const mafiaCount = mafia.length;
    // Kill enough non-mafia, non-player characters so mafiaCount >= innocentCount
    const innocents = s.characters.filter(c => c.role !== 'mafia' && c.id !== 'player' && c.alive);
    // After killing k innocents, alive innocents (including player) = (innocents.length + 1 - k)
    // Parity when mafiaCount >= innocents.length + 1 - k → k >= innocents.length + 1 - mafiaCount
    const toKill = Math.max(0, innocents.length + 1 - mafiaCount);
    for (let i = 0; i < toKill; i++) {
      s = applyVoteResult(s, innocents[i].id);
    }
    const result = checkWinCondition(s);
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.MAFIA_PARITY);
  });

  test('mafia wins on timeout (day > 5)', () => {
    let s = makeState();
    // Force day > 5
    s = { ...s, day: 6 };
    const result = checkWinCondition(s);
    expect(result.state).toBe(WIN_STATES.MAFIA_WINS);
    expect(result.reason).toBe(LOSE_REASONS.TIME_OUT);
  });

  test('returns IN_PROGRESS mid-game', () => {
    const s = makeState();
    const result = checkWinCondition(s);
    expect(result.state).toBe(WIN_STATES.IN_PROGRESS);
  });
});

// ─────────────────────────────────────────────
// Multi-day simulation
// ─────────────────────────────────────────────
describe('Integration: multi-day simulation', () => {
  test('five full days (skip all actions) terminates at game over', () => {
    let s = makeState();
    let days = 0;
    const MAX_ITERATIONS = 200;
    let iterations = 0;

    while (s.phase !== PHASES.GAME_OVER && iterations < MAX_ITERATIONS) {
      iterations++;
      if (s.phase === PHASES.DAY) {
        s = advanceChunk(s);
        const win = checkWinCondition(s);
        if (win.state !== WIN_STATES.IN_PROGRESS) {
          s = { ...s, phase: PHASES.GAME_OVER, gameOver: true };
        }
      } else if (s.phase === PHASES.VOTE) {
        s = transitionToNight(s);
        const mt = mafiaChooseTarget(s);
        const dt = doctorChooseTarget(s);
        if (mt) s = setNightAction(s, 'mafiaTarget', mt);
        if (dt) s = setNightAction(s, 'doctorTarget', dt);
      } else if (s.phase === PHASES.NIGHT) {
        s = resolveNight(s);
        const win = checkWinCondition(s);
        if (win.state !== WIN_STATES.IN_PROGRESS) {
          s = { ...s, phase: PHASES.GAME_OVER, gameOver: true };
        }
      } else if (s.phase === PHASES.DAWN) {
        days++;
        s = transitionToDay(s);
        const win = checkWinCondition(s);
        if (win.state !== WIN_STATES.IN_PROGRESS) {
          s = { ...s, phase: PHASES.GAME_OVER, gameOver: true };
        }
      }
    }

    expect(iterations).toBeLessThan(MAX_ITERATIONS);
    // Either game over from win/lose or we burned all days
    expect([PHASES.GAME_OVER, PHASES.DAY, PHASES.DAWN]).toContain(s.phase);
  });
});

// ─────────────────────────────────────────────
// Phase 5: Full game with poisoning mechanic
// ─────────────────────────────────────────────
describe('Integration: Phase 5 poisoning mechanic', () => {
  // import createGameWithSetup inline to avoid polluting outer scope
  async function getSetupState(seed = 1) {
    const { createGameWithSetup } = await import('../gameState.js');
    return createGameWithSetup({ playerCount: 8 }, makeDeterministicRng(seed));
  }

  test('createGameWithSetup creates 8-player game', async () => {
    const s = await getSetupState();
    expect(s.characters).toHaveLength(8); // 7 NPCs + player
    expect(s.mafiaState).toBeDefined();
    expect(s.mafiaState.coordinated).toBe(false);
  });

  test('mafiaChooseTarget returns null before poisoning', async () => {
    const s = await getSetupState();
    const target = mafiaChooseTarget(s);
    expect(target).toBeNull();
  });

  test('mafiaChooseTarget returns target after poisoning', async () => {
    const s = await getSetupState();
    const nonMafia = s.characters.find(c => c.alive && c.role !== 'mafia');
    const poisonedState = {
      ...s,
      mafiaState: { coordinated: true, target: nonMafia.id, poisoned: true, killerMafiaId: null },
    };
    const stateInNight = { ...poisonedState, phase: PHASES.NIGHT };
    stateInNight.nightActions = { mafiaTarget: null, doctorTarget: null, inspectorTarget: null };

    const stateWithTarget = setNightAction(stateInNight, 'mafiaTarget', mafiaChooseTarget(poisonedState));
    const result = resolveNight(stateWithTarget);
    const victim = result.characters.find(c => c.id === nonMafia.id);
    expect(victim.alive).toBe(false);
  });

  test('no kill when mafia did not poison', async () => {
    const s = await getSetupState();
    const nightState = { ...s, phase: PHASES.NIGHT,
      nightActions: { mafiaTarget: null, doctorTarget: null, inspectorTarget: null } };
    // mafiaChooseTarget returns null → no kill
    const target = mafiaChooseTarget(nightState);
    expect(target).toBeNull();
    const result = resolveNight(nightState);
    expect(result.lastNightResult.killResult.type).toBe('no_kill');
  });

  test('full 3-day game with poisoning mechanic', async () => {
    const { moveNPCs } = await import('../npcMovement.js');
    let s = await getSetupState(42);
    const rng = makeDeterministicRng(42);
    let days = 0;
    const MAX_ITER = 300;
    let iter = 0;

    while (s.phase !== PHASES.GAME_OVER && iter < MAX_ITER && days < 3) {
      iter++;
      if (s.phase === PHASES.DAY) {
        s = moveNPCs(s, rng); // NPCs move
        s = advanceChunk(s);
        const win = checkWinCondition(s);
        if (win.state !== WIN_STATES.IN_PROGRESS) {
          s = { ...s, phase: PHASES.GAME_OVER, gameOver: true };
        }
      } else if (s.phase === PHASES.VOTE) {
        s = transitionToNight(s);
        const mt = mafiaChooseTarget(s);
        const dt = doctorChooseTarget(s);
        if (mt) s = setNightAction(s, 'mafiaTarget', mt);
        if (dt) s = setNightAction(s, 'doctorTarget', dt);
      } else if (s.phase === PHASES.NIGHT) {
        s = resolveNight(s);
        const win = checkWinCondition(s);
        if (win.state !== WIN_STATES.IN_PROGRESS) {
          s = { ...s, phase: PHASES.GAME_OVER, gameOver: true };
        }
      } else if (s.phase === PHASES.DAWN) {
        days++;
        s = transitionToDay(s);
      }
    }

    expect(iter).toBeLessThan(MAX_ITER);
    expect(days).toBeGreaterThan(0);
    // State is consistent
    const aliveMafia = s.characters.filter(c => c.role === 'mafia' && c.alive);
    const aliveInnocents = s.characters.filter(c => c.role !== 'mafia' && c.alive);
    expect(aliveMafia.length + aliveInnocents.length).toBeGreaterThan(0);
  });
});
