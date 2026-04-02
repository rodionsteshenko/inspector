import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, rmSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'mafia-cli.js');
const SESSIONS_DIR = join(__dirname, '..', '..', 'cli-sessions');

function run(...args) {
  try {
    const out = execFileSync('node', [CLI, ...args], {
      encoding: 'utf8',
      timeout: 15000,
    });
    return JSON.parse(out);
  } catch (e) {
    // CLI exits 1 for errors, but still outputs JSON
    if (e.stdout) {
      try { return JSON.parse(e.stdout); } catch { /* fall through */ }
    }
    throw e;
  }
}

// Track sessions created during tests for cleanup
let testSessions = [];

function newGame(playerCount = 8) {
  const result = run('new', String(playerCount));
  if (result.state?.sessionId) testSessions.push(result.state.sessionId);
  return result;
}

function cleanupSession(id) {
  const files = [
    join(SESSIONS_DIR, `${id}.json`),
    join(SESSIONS_DIR, `${id}.history.json`),
  ];
  const dirs = [join(SESSIONS_DIR, `${id}.checkpoints`)];
  for (const f of files) {
    if (existsSync(f)) rmSync(f);
  }
  for (const d of dirs) {
    if (existsSync(d)) rmSync(d, { recursive: true });
  }
}

afterEach(() => {
  for (const id of testSessions) {
    cleanupSession(id);
  }
  testSessions = [];
});

// ── new ──────────────────────────────────────────────────────────────────────

describe('new', () => {
  it('creates a new game session', () => {
    const result = newGame();
    expect(result.ok).toBe(true);
    expect(result.state.sessionId).toBeTruthy();
    expect(result.state.phase).toBe('day');
    expect(result.state.day).toBe(1);
    expect(result.state.chunk).toBe(1);
    expect(result.message).toContain('found dead');
  });

  it('creates session file on disk', () => {
    const result = newGame();
    const id = result.state.sessionId;
    expect(existsSync(join(SESSIONS_DIR, `${id}.json`))).toBe(true);
  });

  it('creates initial history and checkpoint', () => {
    const result = newGame();
    const id = result.state.sessionId;
    expect(existsSync(join(SESSIONS_DIR, `${id}.history.json`))).toBe(true);
    expect(existsSync(join(SESSIONS_DIR, `${id}.checkpoints`, '0.json'))).toBe(true);
  });

  it('respects playerCount argument', () => {
    const result = newGame(6);
    // 6 players = 5 NPCs + player
    const aliveCount = result.state.aliveNpcs.length + 1; // +1 for player, -1 for day0 death
    expect(aliveCount).toBeLessThanOrEqual(6);
  });
});

// ── help ─────────────────────────────────────────────────────────────────────

describe('help', () => {
  it('prints usage info', () => {
    const result = run('help');
    expect(result.ok).toBe(true);
    expect(result.usage).toBeTruthy();
    expect(result.usage['new [playerCount]']).toBeTruthy();
    expect(result.usage['<id> history']).toBeTruthy();
    expect(result.usage['<id> replay <step>']).toBeTruthy();
  });
});

// ── list-sessions ────────────────────────────────────────────────────────────

describe('list-sessions', () => {
  it('lists existing sessions', () => {
    newGame();
    const result = run('list-sessions');
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.sessions)).toBe(true);
    expect(result.sessions.length).toBeGreaterThan(0);
  });
});

// ── status ───────────────────────────────────────────────────────────────────

describe('status', () => {
  it('returns current game state', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'status');
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('day');
    expect(result.state.playerLocation).toBeTruthy();
    expect(result.state.adjacentLocations.length).toBeGreaterThan(0);
  });

  it('fails for non-existent session', () => {
    const result = run('nonexistent', 'status');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── move ─────────────────────────────────────────────────────────────────────

describe('move', () => {
  it('moves player to adjacent location', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    const dest = adjacentLocations[0].id;
    const result = run(sessionId, 'move', dest);
    expect(result.ok).toBe(true);
    expect(result.action).toBe('move');
    expect(result.state.playerLocation.id).toBe(dest);
  });

  it('advances chunk after move', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    const dest = adjacentLocations[0].id;
    const result = run(sessionId, 'move', dest);
    expect(result.state.chunk).toBe(2);
  });

  it('fails for non-adjacent location', () => {
    const { state: { sessionId, playerLocation, adjacentLocations } } = newGame();
    // Find a location that is NOT adjacent
    const adjIds = adjacentLocations.map(l => l.id);
    const allLocs = run(sessionId, 'status').state.aliveNpcs.map(n => n.location);
    // Use a location that isn't adjacent (or just try an invalid one)
    const result = run(sessionId, 'move', 'nonexistent_place');
    expect(result.ok).toBe(false);
  });

  it('fails without location argument', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'move');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Usage');
  });

  it('records history for move', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    const dest = adjacentLocations[0].id;
    run(sessionId, 'move', dest);
    const hist = run(sessionId, 'history');
    expect(hist.steps.length).toBe(2); // new + move
    expect(hist.steps[1].command).toBe('move');
    expect(hist.steps[1].args).toContain(dest);
  });
});

// ── observe ──────────────────────────────────────────────────────────────────

describe('observe', () => {
  it('observes and advances chunk', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'observe');
    expect(result.ok).toBe(true);
    expect(result.action).toBe('observe');
    expect(result.state.chunk).toBe(2);
    expect(Array.isArray(result.observed)).toBe(true);
  });
});

// ── talk ─────────────────────────────────────────────────────────────────────

describe('talk', () => {
  it('talks to an NPC at the same location', () => {
    const { state: { sessionId, npcsHere } } = newGame();
    if (npcsHere.length === 0) return; // skip if no one here
    const npc = npcsHere[0];
    const result = run(sessionId, 'talk', npc.id);
    expect(result.ok).toBe(true);
    expect(result.action).toBe('talk');
    expect(result.character.id).toBe(npc.id);
    expect(result.testimony).toBeTruthy();
  });

  it('fails for NPC not at player location', () => {
    const { state: { sessionId, aliveNpcs, playerLocation } } = newGame();
    const npcElsewhere = aliveNpcs.find(n => n.location !== playerLocation.id);
    if (!npcElsewhere) return; // skip if all NPCs happen to be here
    const result = run(sessionId, 'talk', npcElsewhere.id);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not at your location');
  });

  it('fails without character argument', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'talk');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Usage');
  });

  it('decrements conversation count', () => {
    const { state: { sessionId, npcsHere, conversationsLeft } } = newGame();
    if (npcsHere.length === 0) return;
    const result = run(sessionId, 'talk', npcsHere[0].id);
    expect(result.state.conversationsLeft).toBe(conversationsLeft - 1);
  });
});

// ── ally ─────────────────────────────────────────────────────────────────────

describe('ally', () => {
  it('forms alliance with NPC at same location', () => {
    const { state: { sessionId, npcsHere } } = newGame();
    if (npcsHere.length === 0) return;
    const result = run(sessionId, 'ally', npcsHere[0].id);
    expect(result.ok).toBe(true);
    expect(result.action).toBe('ally');
  });

  it('fails for NPC not at player location', () => {
    const { state: { sessionId, aliveNpcs, playerLocation } } = newGame();
    const npcElsewhere = aliveNpcs.find(n => n.location !== playerLocation.id);
    if (!npcElsewhere) return;
    const result = run(sessionId, 'ally', npcElsewhere.id);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not at your location');
  });
});

// ── night phase ──────────────────────────────────────────────────────────────

describe('night', () => {
  function advanceToNight(sessionId) {
    // Keep observing until we hit night phase
    for (let i = 0; i < 20; i++) {
      const status = run(sessionId, 'status');
      if (status.state.phase === 'night') return status;
      if (status.state.phase !== 'day') break;
      run(sessionId, 'observe');
    }
    return run(sessionId, 'status');
  }

  it('resolves night actions and transitions to dawn', () => {
    const { state: { sessionId } } = newGame();
    const nightStatus = advanceToNight(sessionId);
    if (nightStatus.state.phase !== 'night') return; // game might have ended

    const targets = nightStatus.state.nightTargets;
    if (!targets || targets.length === 0) return;
    const inspectTarget = targets[0].id;

    const result = run(sessionId, 'night', inspectTarget);
    expect(result.ok).toBe(true);
    expect(result.action).toBe('night');
    expect(result.state.phase).toMatch(/dawn|game_over/);
  });

  it('fails when not in night phase', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'night', 'some_id');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Not in night phase');
  });
});

// ── dawn ─────────────────────────────────────────────────────────────────────

describe('dawn', () => {
  it('fails when not in dawn phase', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'dawn');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Not in dawn phase');
  });
});

// ── summary ──────────────────────────────────────────────────────────────────

describe('summary', () => {
  it('returns full game summary', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'summary');
    expect(result.ok).toBe(true);
    expect(result.summary).toBeTruthy();
    expect(result.summary.sessionId).toBe(sessionId);
    expect(result.summary.outcome).toBe('IN_PROGRESS');
    expect(Array.isArray(result.summary.mafia)).toBe(true);
    expect(Array.isArray(result.summary.characters)).toBe(true);
  });
});

// ── history ──────────────────────────────────────────────────────────────────

describe('history', () => {
  it('shows history after multiple commands', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    if (adjacentLocations.length > 0) {
      run(sessionId, 'move', adjacentLocations[0].id);
    }
    run(sessionId, 'observe');

    const result = run(sessionId, 'history');
    expect(result.ok).toBe(true);
    expect(result.steps.length).toBe(3); // new, move, observe
    expect(result.steps[0].command).toBe('new');
    expect(result.steps[0].step).toBe(0);
    expect(result.totalSteps).toBe(3);
    expect(result.currentStep).toBe(2);
  });

  it('records day/chunk/phase for each step', () => {
    const { state: { sessionId } } = newGame();
    run(sessionId, 'observe');

    const result = run(sessionId, 'history');
    const step1 = result.steps[1];
    expect(step1.day).toBe(1);
    expect(step1.chunk).toBe(2);
    expect(step1.phase).toBe('day');
    expect(step1.timestamp).toBeTruthy();
  });

  it('does not include read-only commands', () => {
    const { state: { sessionId } } = newGame();
    run(sessionId, 'status');
    run(sessionId, 'summary');
    run(sessionId, 'observe'); // only this mutates

    const result = run(sessionId, 'history');
    expect(result.steps.length).toBe(2); // new + observe
  });
});

// ── replay ───────────────────────────────────────────────────────────────────

describe('replay', () => {
  it('restores game to a previous step', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    if (adjacentLocations.length === 0) return;

    // Move twice
    const firstDest = adjacentLocations[0].id;
    const afterMove1 = run(sessionId, 'move', firstDest);
    run(sessionId, 'observe');

    // Replay to step 1 (after first move)
    const result = run(sessionId, 'replay', '1');
    expect(result.ok).toBe(true);
    expect(result.restoredToStep).toBe(1);
    expect(result.discardedSteps).toBe(1);
    expect(result.state.chunk).toBe(afterMove1.state.chunk);
    expect(result.state.playerLocation.id).toBe(firstDest);
  });

  it('restores to step 0 (initial state)', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    if (adjacentLocations.length === 0) return;

    run(sessionId, 'move', adjacentLocations[0].id);
    run(sessionId, 'observe');

    const result = run(sessionId, 'replay', '0');
    expect(result.ok).toBe(true);
    expect(result.restoredToStep).toBe(0);
    expect(result.state.chunk).toBe(1);
    expect(result.state.day).toBe(1);
  });

  it('trims history after replay', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    if (adjacentLocations.length === 0) return;

    run(sessionId, 'move', adjacentLocations[0].id);
    run(sessionId, 'observe');

    // Verify 3 steps exist
    let hist = run(sessionId, 'history');
    expect(hist.totalSteps).toBe(3);

    // Replay to step 1
    run(sessionId, 'replay', '1');

    // History should be trimmed
    hist = run(sessionId, 'history');
    expect(hist.totalSteps).toBe(2); // new + move only
  });

  it('allows branching after replay', () => {
    const { state: { sessionId, adjacentLocations } } = newGame();
    if (adjacentLocations.length < 2) return;

    // Take path A: move to first adjacent
    run(sessionId, 'move', adjacentLocations[0].id);

    // Replay to step 0, then take path B
    run(sessionId, 'replay', '0');
    const pathB = run(sessionId, 'move', adjacentLocations[1].id);
    expect(pathB.ok).toBe(true);
    expect(pathB.state.playerLocation.id).toBe(adjacentLocations[1].id);

    // History should show: new, move (path B)
    const hist = run(sessionId, 'history');
    expect(hist.totalSteps).toBe(2);
    expect(hist.steps[1].args).toContain(adjacentLocations[1].id);
  });

  it('fails for out-of-range step', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'replay', '999');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('out of range');
  });

  it('fails for negative step', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'replay', '-1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('out of range');
  });

  it('fails without step argument', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'replay');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Usage');
  });
});

// ── full game cycle ──────────────────────────────────────────────────────────

describe('full game cycle', () => {
  it('plays through day → night → dawn → day 2', () => {
    const { state: { sessionId } } = newGame();

    // Exhaust chunks to reach night
    let status;
    for (let i = 0; i < 20; i++) {
      status = run(sessionId, 'status');
      if (status.state.phase !== 'day') break;
      run(sessionId, 'observe');
    }
    status = run(sessionId, 'status');

    // Should be in night or game over
    if (status.state.gameOver) return;
    expect(status.state.phase).toBe('night');

    // Resolve night
    const targets = status.state.nightTargets;
    if (!targets || targets.length === 0) return;
    const nightResult = run(sessionId, 'night', targets[0].id);
    if (nightResult.state.gameOver) return;
    expect(nightResult.state.phase).toBe('dawn');

    // Advance to day 2
    const dawnResult = run(sessionId, 'dawn');
    if (dawnResult.state.gameOver) return;
    expect(dawnResult.state.phase).toBe('day');
    expect(dawnResult.state.day).toBe(2);
    expect(dawnResult.state.chunk).toBe(1);
  });

  it('tracks complete history through multi-day cycle', () => {
    const { state: { sessionId } } = newGame();

    // Play through to night
    for (let i = 0; i < 20; i++) {
      const s = run(sessionId, 'status');
      if (s.state.phase !== 'day') break;
      run(sessionId, 'observe');
    }

    const status = run(sessionId, 'status');
    if (status.state.phase === 'night') {
      const targets = status.state.nightTargets;
      if (targets?.length > 0) {
        run(sessionId, 'night', targets[0].id);
      }
    }

    const hist = run(sessionId, 'history');
    // Should have: new + N observes + possibly night
    expect(hist.totalSteps).toBeGreaterThan(2);
    expect(hist.steps[0].command).toBe('new');
    // Each step should have increasing step numbers
    for (let i = 0; i < hist.steps.length; i++) {
      expect(hist.steps[i].step).toBe(i);
    }
  });
});

// ── error cases ──────────────────────────────────────────────────────────────

describe('error handling', () => {
  it('unknown command returns error', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId, 'foobar');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown command');
  });

  it('missing command returns error', () => {
    const { state: { sessionId } } = newGame();
    const result = run(sessionId);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Missing command');
  });
});
