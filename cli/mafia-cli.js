#!/usr/bin/env node
/**
 * Mafia Game CLI — turn-based, session-based, agent-drivable.
 *
 * Usage:
 *   node cli/mafia-cli.js new [playerCount]
 *   node cli/mafia-cli.js <sessionId> status
 *   node cli/mafia-cli.js <sessionId> move <locId>
 *   node cli/mafia-cli.js <sessionId> observe
 *   node cli/mafia-cli.js <sessionId> talk <charId>
 *   node cli/mafia-cli.js <sessionId> ally <charId>
 *   node cli/mafia-cli.js <sessionId> night <inspectId> [eliminateId]
 *   node cli/mafia-cli.js <sessionId> dawn
 *   node cli/mafia-cli.js <sessionId> summary
 *   node cli/mafia-cli.js <sessionId> history
 *   node cli/mafia-cli.js <sessionId> replay <step>
 *   node cli/mafia-cli.js list-sessions
 *
 * All output is JSON. Exit 0 = success, 1 = error.
 * Each mutating command auto-saves state and appends to _history for replay.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, '../cli-sessions');

// ── Engine imports ────────────────────────────────────────────────────────
import {
  createGameWithSetup, advanceChunk, transitionToDay,
  setNightAction, recordConversation, PHASES,
} from '../src/engine/gameState.js';
import { movePlayer, generateLocationObservation, logMovementToEvidence } from '../src/engine/movement.js';
import { resolveNight, doctorChooseTarget, mafiaChooseTarget } from '../src/engine/nightResolution.js';
import { checkWinCondition, formAlliance, WIN_STATES } from '../src/engine/winCondition.js';
import { moveNPCs } from '../src/engine/npcMovement.js';
import { getNodeById, getAdjacentLocations, MAP_NODES, ADJACENCY_MAP } from '../src/engine/map.js';
import { getCharactersAtLocation } from '../src/engine/characters.js';
import { runContradictionCheck } from '../src/engine/evidenceBoard.js';

// ── Session persistence ───────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

function sessionPath(id) {
  return join(SESSIONS_DIR, `${id}.json`);
}

function loadSession(id) {
  const p = sessionPath(id);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function saveSession(id, state) {
  ensureDir();
  writeFileSync(sessionPath(id), JSON.stringify(state, null, 2));
}

function appendHistory(id, state, command, args) {
  const histPath = join(SESSIONS_DIR, `${id}.history.json`);
  let history = [];
  if (existsSync(histPath)) {
    try { history = JSON.parse(readFileSync(histPath, 'utf8')); } catch { history = []; }
  }
  history.push({
    step: history.length,
    command,
    args: args || [],
    day: state.day,
    chunk: state.chunk,
    phase: state.phase,
    timestamp: new Date().toISOString(),
  });
  writeFileSync(histPath, JSON.stringify(history, null, 2));
}

function saveCheckpoint(id, step, state) {
  const cpDir = join(SESSIONS_DIR, `${id}.checkpoints`);
  if (!existsSync(cpDir)) mkdirSync(cpDir, { recursive: true });
  writeFileSync(join(cpDir, `${step}.json`), JSON.stringify(state, null, 2));
}

function loadCheckpoint(id, step) {
  const cpPath = join(SESSIONS_DIR, `${id}.checkpoints`, `${step}.json`);
  if (!existsSync(cpPath)) return null;
  try { return JSON.parse(readFileSync(cpPath, 'utf8')); } catch { return null; }
}

function loadHistory(id) {
  const histPath = join(SESSIONS_DIR, `${id}.history.json`);
  if (!existsSync(histPath)) return [];
  try { return JSON.parse(readFileSync(histPath, 'utf8')); } catch { return []; }
}

function trimHistoryTo(id, step) {
  const histPath = join(SESSIONS_DIR, `${id}.history.json`);
  const history = loadHistory(id);
  const trimmed = history.slice(0, step + 1);
  writeFileSync(histPath, JSON.stringify(trimmed, null, 2));
  // Remove checkpoints after this step
  const cpDir = join(SESSIONS_DIR, `${id}.checkpoints`);
  if (existsSync(cpDir)) {
    for (const f of readdirSync(cpDir)) {
      const cpStep = parseInt(f.replace('.json', ''));
      if (cpStep > step) {
        unlinkSync(join(cpDir, f));
      }
    }
  }
}

function listSessions() {
  ensureDir();
  return readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const id = f.replace('.json', '');
      try {
        const s = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf8'));
        return {
          id,
          day: s.day, phase: s.phase,
          alive: s.characters.filter(c => c.alive).length,
          gameOver: !!s.gameOver, winner: s.winner || null,
          day0Victim: s.day0Murder?.victimName || null,
          createdAt: s._createdAt || null,
        };
      } catch { return { id, error: 'corrupt' }; }
    });
}

// ── Game helpers ──────────────────────────────────────────────────────────

function checkAndApplyWin(state) {
  const result = checkWinCondition(state);
  if (result.state !== WIN_STATES.IN_PROGRESS) {
    return {
      ...state, phase: PHASES.GAME_OVER, gameOver: true,
      winner: result.state === WIN_STATES.PLAYER_WINS ? 'player' : 'mafia',
      winReason: result.reason,
    };
  }
  return state;
}

function setNPCNightTargets(state) {
  if (state.phase !== PHASES.NIGHT) return state;
  let s = state;
  const mt = mafiaChooseTarget(s);
  const dt = doctorChooseTarget(s);
  if (mt) s = setNightAction(s, 'mafiaTarget', mt);
  if (dt) s = setNightAction(s, 'doctorTarget', dt);
  return s;
}

function mapCfg(state) {
  return {
    nodes: state.mapConfig?.nodes || MAP_NODES,
    adj: state.mapConfig?.adjacencyMap || ADJACENCY_MAP,
  };
}

// ── View serializer ───────────────────────────────────────────────────────
// Returns a clean, agent-readable snapshot of the current game state.
// Does NOT include hidden info (mafia identities are not exposed here).

function view(state) {
  const { nodes, adj } = mapCfg(state);
  const currentNode = getNodeById(state.playerLocation, nodes);
  const adjacentIds = getAdjacentLocations(state.playerLocation, adj);

  const adjacentLocations = adjacentIds.map(id => {
    const node = getNodeById(id, nodes);
    const occupants = state.characters.filter(c => c.alive && c.location === id && c.id !== 'player');
    const atCapacity = node ? occupants.length >= node.capacity : false;
    return {
      id, name: node?.name,
      occupants: occupants.map(c => ({ id: c.id, name: c.name })),
      atCapacity,
    };
  });

  const npcsHere = getCharactersAtLocation(state.characters, state.playerLocation)
    .filter(c => c.id !== 'player' && c.alive)
    .map(c => ({ id: c.id, name: c.name, personality: c.personality, alliedWithInspector: !!c.alliedWithInspector }));

  const aliveNpcs = state.characters
    .filter(c => c.id !== 'player' && c.alive)
    .map(c => ({ id: c.id, name: c.name, location: c.location }));

  const out = {
    sessionId: state._sessionId,
    phase: state.phase,
    day: state.day,
    chunk: state.chunk,
    chunksPerDay: state.chunksPerDay || 8,
    playerLocation: { id: state.playerLocation, name: currentNode?.name },
    adjacentLocations,
    npcsHere,
    aliveNpcs,
    conversationsLeft: state.conversationsAvailable - state.conversationsUsed,
    conversationsAvailable: state.conversationsAvailable,
    day0Murder: state.day0Murder || null,
    confirmedRoles: state.evidenceBoard?.confirmedRoles || {},
    deathLog: state.evidenceBoard?.deathLog || [],
    contradictions: state.evidenceBoard?.contradictions || [],
    alliances: state.evidenceBoard?.alliances || [],
    gameOver: !!state.gameOver,
    winner: state.winner || null,
    winReason: state.winReason || null,
  };

  if (state.phase === PHASES.NIGHT) {
    out.investigationsAvailable = state.investigationsAvailable;
    out.investigationsUsed = state.investigationsUsed || 0;
    out.nightTargets = aliveNpcs;
  }

  if (state.phase === PHASES.DAWN && state.lastNightResult) {
    out.lastNightResult = state.lastNightResult;
  }

  return out;
}

// ── Monologue builder for CLI (no LLM, uses pre-generated testimony) ──────

function buildCLIMonologue(character, state) {
  const { name, testimony = {} } = character;
  const { locationClaims = [], observations = [], suspicions = [] } = testimony;
  const parts = [];
  if (locationClaims.length > 0) {
    const claim = locationClaims[0];
    parts.push(`I was at the ${claim.claimedLocation.replace('_', ' ')} earlier.`);
  }
  if (observations.length > 0) {
    const obs = observations[0];
    parts.push(`I saw ${obs.subjectName} near the ${obs.location.replace('_', ' ')}.`);
  }
  if (suspicions.length > 0) {
    const s = suspicions[0];
    parts.push(`If you ask me, ${s.targetName} ${s.reason}.`);
  }
  if (parts.length === 0) {
    parts.push("I haven't noticed anything suspicious, Inspector.");
  }
  return parts.join(' ');
}

// ── Command implementations ───────────────────────────────────────────────
// Each returns { ok, result (to print), newState (to save) | null }

function cmdNew(args) {
  const playerCount = parseInt(args[0]) || 8;
  let state = createGameWithSetup({ playerCount });
  const id = randomUUID().slice(0, 8);
  state._sessionId = id;
  state._createdAt = new Date().toISOString();

  return {
    ok: true,
    newState: state,
    result: {
      sessionId: id,
      message: `New game. ${state.day0Murder?.victimName || 'Someone'} was found dead near the ${state.day0Murder?.victimLocation?.replace('_', ' ') || 'village'}.`,
      hint: state.day0Murder?.witnesses?.[0]
        ? `${state.day0Murder.witnesses[0].name} was nearby. They may have seen something.`
        : null,
      state: view(state),
    },
  };
}

function cmdStatus(state) {
  return { ok: true, newState: null, result: { state: view(state) } };
}

function cmdMove(state, args) {
  const toLocation = args[0];
  if (!toLocation) return { ok: false, newState: null, result: { error: 'Usage: move <locationId>' } };
  if (state.phase !== PHASES.DAY) return { ok: false, newState: null, result: { error: `Cannot move during ${state.phase} phase` } };

  try {
    let s = movePlayer(state, toLocation);
    s = moveNPCs(s);
    s = advanceChunk(s);
    s = setNPCNightTargets(s);
    s = checkAndApplyWin(s);
    const { nodes } = mapCfg(s);
    return { ok: true, newState: s, result: { action: 'move', to: { id: toLocation, name: getNodeById(toLocation, nodes)?.name }, state: view(s) } };
  } catch (e) {
    return { ok: false, newState: null, result: { error: e.message } };
  }
}

function cmdObserve(state) {
  if (state.phase !== PHASES.DAY) return { ok: false, newState: null, result: { error: `Cannot observe during ${state.phase} phase` } };

  const obs = generateLocationObservation(state, 'player');
  let s = state;
  if (obs) {
    let board = state.evidenceBoard;
    for (const charId of obs.presentCharacterIds) {
      board = logMovementToEvidence(board, charId, obs.location, obs.day, obs.chunk, 'player');
    }
    s = { ...state, evidenceBoard: board };
  }
  s = moveNPCs(s);
  s = advanceChunk(s);
  s = setNPCNightTargets(s);
  s = checkAndApplyWin(s);

  const observed = (obs?.presentCharacterIds || []).map(id => {
    const c = state.characters.find(x => x.id === id);
    return { id, name: c?.name };
  });

  return { ok: true, newState: s, result: { action: 'observe', observed, state: view(s) } };
}

function cmdTalk(state, args) {
  const charId = args[0];
  if (!charId) return { ok: false, newState: null, result: { error: 'Usage: talk <characterId>' } };
  if (state.phase !== PHASES.DAY) return { ok: false, newState: null, result: { error: `Cannot talk during ${state.phase} phase` } };

  const char = state.characters.find(c => c.id === charId && c.alive);
  if (!char) return { ok: false, newState: null, result: { error: `Character ${charId} not found or dead` } };
  if (char.location !== state.playerLocation) return { ok: false, newState: null, result: { error: `${char.name} is not at your location (they are at ${char.location})` } };
  if (state.conversationsUsed >= state.conversationsAvailable) return { ok: false, newState: null, result: { error: 'No conversations left today' } };

  let s = recordConversation(state);

  // Log conversation and claims to evidence board
  const testimony = char.testimony || {};
  const monologue = buildCLIMonologue(char, state);
  const entry = {
    characterId: charId,
    characterName: char.name,
    location: state.playerLocation,
    day: state.day,
    chunk: state.chunk,
    response: monologue,
  };
  const locationFacts = (testimony.locationClaims || []).map(claim => ({
    type: 'location_claim',
    characterId: charId,
    characterName: char.name,
    location: claim.claimedLocation,
    day: claim.day,
    chunk: claim.chunk,
    verified: char.verifiedByInspector && !claim.isLie,
  }));
  // Add this NPC's observations so they can contradict other NPCs' claims
  const npcObs = (testimony.observations || []).map(obs => ({
    witnessId: charId,
    witnessName: char.name,
    subjectId: obs.subjectId,
    subjectName: obs.subjectName,
    location: obs.location,
    day: obs.day,
    chunk: obs.chunk,
  }));
  let newBoard = {
    ...s.evidenceBoard,
    conversationLogs: [...(s.evidenceBoard.conversationLogs || []), entry],
    claimedFacts: [...(s.evidenceBoard.claimedFacts || []), ...locationFacts],
    npcObservations: [...(s.evidenceBoard.npcObservations || []), ...npcObs],
  };
  newBoard = runContradictionCheck(newBoard);
  s = { ...s, evidenceBoard: newBoard };

  s = moveNPCs(s);
  s = advanceChunk(s);
  s = setNPCNightTargets(s);
  s = checkAndApplyWin(s);

  // Build what this character knows — so the agent (or LLM) can voice them
  const charTestimony = char.testimony || {};
  const witnessed = char.knowledgeState?.witnessed || [];
  const day0 = state.day0Murder;
  const sawVictim = day0 && witnessed.some(w => w.subjectId === day0.victimId && w.day === 0);
  const sawKiller = day0 && witnessed.some(w => w.subjectId === day0.killerId && w.day === 0);
  const killerChar = day0 && state.characters.find(c => c.id === day0.killerId);

  return {
    ok: true,
    newState: s,
    result: {
      action: 'talk',
      character: { id: char.id, name: char.name, personality: char.personality },
      testimony: {
        locationClaims: charTestimony.locationClaims || [],
        observations: charTestimony.observations || [],
        suspicions: charTestimony.suspicions || [],
      },
      witnessContext: {
        sawVictim,
        sawKillerNearby: sawKiller,
        killerName: sawKiller ? killerChar?.name : null,
        victimName: day0?.victimName || null,
        victimLocation: day0?.victimLocation || null,
      },
      state: view(s),
    },
  };
}

function cmdAlly(state, args) {
  const charId = args[0];
  if (!charId) return { ok: false, newState: null, result: { error: 'Usage: ally <characterId>' } };

  const char = state.characters.find(c => c.id === charId && c.alive);
  if (!char) return { ok: false, newState: null, result: { error: `Character ${charId} not found or dead` } };
  if (char.location !== state.playerLocation) return { ok: false, newState: null, result: { error: `${char.name} is not at your location` } };

  let s = formAlliance(state, charId);
  if (s.gameOver) {
    s = { ...s, phase: PHASES.GAME_OVER };
  } else {
    s = checkAndApplyWin(s);
  }

  return {
    ok: true,
    newState: s,
    result: {
      action: 'ally',
      character: { id: char.id, name: char.name },
      outcome: char.role === 'mafia' ? 'MAFIA — game over, your identity is blown' : `Allied with ${char.name} (${char.role})`,
      state: view(s),
    },
  };
}

function cmdNight(state, args) {
  if (state.phase !== PHASES.NIGHT) return { ok: false, newState: null, result: { error: `Not in night phase (currently: ${state.phase})` } };

  const [inspectId, eliminateId] = args;
  let s = state;
  if (inspectId) s = setNightAction(s, 'inspectorTarget', inspectId);
  if (eliminateId) s = setNightAction(s, 'playerEliminate', eliminateId);
  s = resolveNight(s);
  s = checkAndApplyWin(s);

  return {
    ok: true,
    newState: s,
    result: { action: 'night', inspected: inspectId || null, eliminated: eliminateId || null, state: view(s) },
  };
}

function cmdDawn(state) {
  if (state.phase !== PHASES.DAWN) return { ok: false, newState: null, result: { error: `Not in dawn phase (currently: ${state.phase})` } };

  let s = transitionToDay(state);
  s = checkAndApplyWin(s);

  return { ok: true, newState: s, result: { action: 'dawn', state: view(s) } };
}

function cmdHistory(state) {
  const history = loadHistory(state._sessionId);
  return {
    ok: true,
    newState: null,
    result: {
      sessionId: state._sessionId,
      steps: history,
      totalSteps: history.length,
      currentStep: history.length - 1,
    },
  };
}

function cmdReplay(state, args) {
  const stepNum = parseInt(args[0]);
  if (isNaN(stepNum)) return { ok: false, newState: null, result: { error: 'Usage: replay <step>' } };

  const history = loadHistory(state._sessionId);
  if (stepNum < 0 || stepNum >= history.length) {
    return { ok: false, newState: null, result: { error: `Step ${stepNum} out of range (0-${history.length - 1})` } };
  }

  const checkpoint = loadCheckpoint(state._sessionId, stepNum);
  if (!checkpoint) {
    return { ok: false, newState: null, result: { error: `No checkpoint found for step ${stepNum}` } };
  }

  // Trim history to this step (future steps are discarded)
  trimHistoryTo(state._sessionId, stepNum);

  return {
    ok: true,
    newState: checkpoint,
    result: {
      action: 'replay',
      restoredToStep: stepNum,
      discardedSteps: history.length - 1 - stepNum,
      restoredCommand: history[stepNum],
      state: view(checkpoint),
    },
  };
}

function cmdSummary(state) {
  const confirmedRoles = state.evidenceBoard?.confirmedRoles || {};
  return {
    ok: true,
    newState: null,
    result: {
      summary: {
        sessionId: state._sessionId,
        outcome: state.gameOver
          ? (state.winner === 'player' ? 'PLAYER_WINS' : 'MAFIA_WINS')
          : 'IN_PROGRESS',
        winReason: state.winReason || null,
        daysPlayed: state.day,
        day0Murder: state.day0Murder || null,
        mafia: (state.mafiaIds || []).map(id => {
          const c = state.characters.find(x => x.id === id);
          return { id, name: c?.name, alive: c?.alive, wasIdentified: !!confirmedRoles[id] };
        }),
        deaths: state.evidenceBoard?.deathLog || [],
        alliances: (state.evidenceBoard?.alliances || []).map(a => ({ name: a.characterName, role: a.role, day: a.day })),
        confirmedRoles,
        contradictions: state.evidenceBoard?.contradictions || [],
        conversationCount: (state.evidenceBoard?.conversationLogs || []).length,
        characters: state.characters.map(c => ({
          id: c.id, name: c.name, role: c.role, alive: c.alive,
          alliedWithInspector: !!c.alliedWithInspector,
          confirmedByPlayer: !!confirmedRoles[c.id],
        })),
      },
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────

function printAndExit(result, ok) {
  console.log(JSON.stringify({ ok, ...result }, null, 2));
  process.exit(ok ? 0 : 1);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help') {
  printAndExit({
    usage: {
      'new [playerCount]': 'Start a new game',
      '<id> status': 'Show current state',
      '<id> move <locationId>': 'Move to adjacent location',
      '<id> observe': 'Observe quietly (passes a chunk)',
      '<id> talk <charId>': 'Get character testimony + witness context',
      '<id> ally <charId>': 'Propose alliance (reveals your identity)',
      '<id> night <inspectId> [eliminateId]': 'Confirm night actions',
      '<id> dawn': 'Advance to next day',
      '<id> summary': 'Full game summary for evaluation',
      '<id> history': 'List all checkpoints (step number, command, day/chunk/phase)',
      '<id> replay <step>': 'Restore game to a previous step (branches from that point)',
      'list-sessions': 'List all saved sessions',
    },
  }, true);
}

if (args[0] === 'list-sessions') {
  printAndExit({ sessions: listSessions() }, true);
}

if (args[0] === 'new') {
  const { ok, result, newState } = cmdNew(args.slice(1));
  if (ok && newState) {
    saveSession(newState._sessionId, newState);
    appendHistory(newState._sessionId, newState, 'new', args.slice(1));
    saveCheckpoint(newState._sessionId, 0, newState);
  }
  printAndExit(result, ok);
}

// Session commands
const sessionId = args[0];
const command = args[1];
const cmdArgs = args.slice(2);

if (!command) {
  printAndExit({ error: 'Missing command. Run with help.' }, false);
}

const state = loadSession(sessionId);
if (!state) {
  printAndExit({ error: `Session "${sessionId}" not found. Run list-sessions to see existing sessions.` }, false);
}

const handlers = {
  status:  () => cmdStatus(state),
  move:    () => cmdMove(state, cmdArgs),
  observe: () => cmdObserve(state),
  talk:    () => cmdTalk(state, cmdArgs),
  ally:    () => cmdAlly(state, cmdArgs),
  night:   () => cmdNight(state, cmdArgs),
  dawn:    () => cmdDawn(state),
  summary: () => cmdSummary(state),
  history: () => cmdHistory(state),
  replay:  () => cmdReplay(state, cmdArgs),
};

if (!handlers[command]) {
  printAndExit({ error: `Unknown command: "${command}". Run with help.` }, false);
}

const { ok, result, newState } = handlers[command]();

// Save updated state if the command mutated anything
if (ok && newState) {
  saveSession(sessionId, newState);
  // Track history and save checkpoint for all mutating commands (except replay, which manages its own history)
  if (command !== 'replay') {
    const history = loadHistory(sessionId);
    const nextStep = history.length;
    appendHistory(sessionId, newState, command, cmdArgs);
    saveCheckpoint(sessionId, nextStep, newState);
  }
}

printAndExit(result, ok);
