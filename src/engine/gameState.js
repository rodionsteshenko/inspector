// Full game state, day/chunk/phase tracking

import { ROLES, assignRoles, assignRolesFromPool, PLAYER_COUNT_CONFIGS, NPC_ROLE_POOL, shuffle } from './roles.js';
import { NPC_DEFINITIONS, PLAYER_CHARACTER, createCharacter, createPlayer, getNPCIds } from './characters.js';
import { MAP_NODES, buildAdjacencyMap } from './map.js';
import { MAP_LAYOUTS, DEFAULT_MAP_LAYOUT } from './mapDefinitions.js';
import { createDayMafiaState, planMafiaDay } from './poisoning.js';
import { generateAllTestimony } from './testimony.js';
import { runDay0Murder } from './day0.js';
import { observeNPCCoPresence } from './movement.js';

export const PHASES = {
  SETUP: 'setup',
  REVEAL: 'reveal',
  DAY: 'day',
  NIGHT: 'night',
  DAWN: 'dawn',
  VOTE: 'vote',
  GAME_OVER: 'game_over',
};

export const CHUNKS_PER_DAY = 8;
export const MAX_DAYS = 5;
export const BASE_INVESTIGATIONS_PER_NIGHT = 1;
export const BASE_CONVERSATIONS_PER_DAY = 3;

export function createInitialGameState(rng = Math.random) {
  // Pick 11 NPCs randomly from the full roster
  const allDefs = shuffle([...NPC_DEFINITIONS], rng);
  const selectedDefs = allDefs.slice(0, NPC_ROLE_POOL.length);
  const npcIds = selectedDefs.map(d => d.id);
  const roleAssignments = assignRoles(npcIds, rng);

  // Assign starting locations randomly
  const allIds = [PLAYER_CHARACTER.id, ...npcIds];
  const locationAssignments = {};
  for (const id of allIds) {
    const nodeIdx = Math.floor(rng() * MAP_NODES.length);
    locationAssignments[id] = MAP_NODES[nodeIdx].id;
  }

  // Create player
  const player = createPlayer(locationAssignments[PLAYER_CHARACTER.id]);

  // Create NPC characters
  const npcs = selectedDefs.map(def =>
    createCharacter(def, roleAssignments[def.id], locationAssignments[def.id])
  );

  // Find mason's confirmed innocent (another innocent NPC)
  const masonId = npcIds.find(id => roleAssignments[id] === ROLES.MASON);
  const masonKnownInnocent = masonId
    ? npcIds.find(id => id !== masonId && roleAssignments[id] !== ROLES.MAFIA) || null
    : null;

  // Find mafia members (they know each other)
  const mafiaIds = npcIds.filter(id => roleAssignments[id] === ROLES.MAFIA);

  return {
    day: 1,
    chunk: 1,
    phase: PHASES.DAY,
    playerLocation: locationAssignments[PLAYER_CHARACTER.id],
    characters: [player, ...npcs],
    evidenceBoard: {
      confirmedRoles: {},      // { characterId: role } — from player investigations
      movementLogs: [],        // observations of characters at locations
      contradictions: [],      // detected contradictions
      deathLog: [],            // who died, when, where last seen
      alliances: [],           // mutual reveals
      allyObservations: [],    // observations from allied characters
    },
    investigationsUsed: 0,
    investigationsAvailable: BASE_INVESTIGATIONS_PER_NIGHT,
    conversationsUsed: 0,
    conversationsAvailable: BASE_CONVERSATIONS_PER_DAY,
    nightActions: {
      mafiaTarget: null,       // who mafia will kill
      doctorTarget: null,      // who doctor will protect
      inspectorTarget: null,   // who player will investigate
      playerEliminate: null,   // who player will eliminate directly
    },
    lastNightResult: null,     // result from previous night
    masonKnownInnocent,
    mafiaIds,
    // Note: mafiaState is only added by createGameWithSetup (poisoning mechanic)
    // createInitialGameState leaves it undefined for backward compatibility with tests
    mafiaKnowsInspector: false,
    gameOver: false,
    winner: null,              // 'player' | 'mafia' | null
    eliminatedThisVote: null,
  };
}

// Build a role pool from explicit counts, filling remainder with citizens.
function buildRolePool(npcCount, roleCounts) {
  const pool = [];
  for (let i = 0; i < (roleCounts.mafia || 2); i++) pool.push(ROLES.MAFIA);
  for (let i = 0; i < (roleCounts.doctor || 0); i++) pool.push(ROLES.DOCTOR);
  for (let i = 0; i < (roleCounts.journalist || 0); i++) pool.push(ROLES.JOURNALIST);
  for (let i = 0; i < (roleCounts.mason || 0); i++) pool.push(ROLES.MASON);
  const citizens = npcCount - pool.length;
  for (let i = 0; i < citizens; i++) pool.push(ROLES.CITIZEN);
  return pool;
}

// Create game state with configurable player count and role set
export function createGameWithSetup(config = {}, rng = Math.random) {
  const playerCount = config.playerCount || 8;
  const conversationsPerDay = config.conversationsPerDay || BASE_CONVERSATIONS_PER_DAY;
  const chunksPerDay = config.chunksPerDay || CHUNKS_PER_DAY;
  const playerConfig = PLAYER_COUNT_CONFIGS[playerCount] || PLAYER_COUNT_CONFIGS[8];
  const { npcCount } = playerConfig;

  // Use custom role counts if provided, otherwise fall back to preset
  const rolePool = config.roleCounts
    ? buildRolePool(npcCount, config.roleCounts)
    : playerConfig.rolePool;

  // Pick npcCount NPCs from NPC_DEFINITIONS (shuffled)
  const allDefs = shuffle([...NPC_DEFINITIONS], rng);
  const selectedDefs = allDefs.slice(0, npcCount);
  const selectedIds = selectedDefs.map(d => d.id);

  const roleAssignments = assignRolesFromPool(selectedIds, rolePool, rng);

  // Build map config from selected layout
  const layout = MAP_LAYOUTS[config.mapLayout || DEFAULT_MAP_LAYOUT];
  const mapConfig = {
    ...layout,
    adjacencyMap: buildAdjacencyMap(layout.nodes, layout.edges),
  };

  // Assign starting locations randomly across the selected map
  const allIds = [PLAYER_CHARACTER.id, ...selectedIds];
  const locationAssignments = {};
  for (const id of allIds) {
    const nodeIdx = Math.floor(rng() * mapConfig.nodes.length);
    locationAssignments[id] = mapConfig.nodes[nodeIdx].id;
  }

  const player = createPlayer(locationAssignments[PLAYER_CHARACTER.id]);
  const npcs = selectedDefs.map(def =>
    createCharacter(def, roleAssignments[def.id], locationAssignments[def.id])
  );

  const masonId = selectedIds.find(id => roleAssignments[id] === ROLES.MASON);
  const masonKnownInnocent = masonId
    ? selectedIds.find(id => id !== masonId && roleAssignments[id] !== ROLES.MAFIA) || null
    : null;

  const mafiaIds = selectedIds.filter(id => roleAssignments[id] === ROLES.MAFIA);

  const baseState = {
    day: 1,
    chunk: 1,
    phase: PHASES.DAY,
    mapConfig,
    playerLocation: locationAssignments[PLAYER_CHARACTER.id],
    characters: [player, ...npcs],
    evidenceBoard: {
      confirmedRoles: {},
      movementLogs: [],
      contradictions: [],
      deathLog: [],
      alliances: [],
      allyObservations: [],
    },
    investigationsUsed: 0,
    investigationsAvailable: BASE_INVESTIGATIONS_PER_NIGHT,
    conversationsUsed: 0,
    conversationsAvailable: conversationsPerDay,
    conversationsPerDay,
    chunksPerDay,
    nightActions: {
      mafiaTarget: null,
      doctorTarget: null,
      inspectorTarget: null,
      playerEliminate: null,
    },
    lastNightResult: null,
    masonKnownInnocent,
    mafiaIds,
    mafiaKnowsInspector: false,
    gameOver: false,
    winner: null,
    eliminatedThisVote: null,
    setupConfig: { playerCount, conversationsPerDay, chunksPerDay },
  };

  // Plan day 1 mafia activity
  const initialState = { ...baseState, mafiaState: createDayMafiaState() };
  const plannedState = { ...initialState, mafiaState: planMafiaDay(initialState, rng) };

  // Generate day 1 testimony for all NPCs
  const withTestimony = generateAllTestimony(plannedState, 1, rng);

  // Run the off-screen Day 0 murder — someone died before you arrived
  const withMurder = runDay0Murder(withTestimony, rng);

  // Seed initial NPC co-presence observations (Day 1, chunk 1 — everyone at their starting locations)
  return observeNPCCoPresence(withMurder);
}

export function advanceChunk(state) {
  if (state.phase !== PHASES.DAY) {
    throw new Error('Can only advance chunk during day phase');
  }
  const chunksPerDay = state.chunksPerDay || CHUNKS_PER_DAY;
  const nextChunk = state.chunk + 1;
  if (nextChunk > chunksPerDay) {
    return {
      ...state,
      chunk: chunksPerDay,
      phase: PHASES.NIGHT,
      nightActions: { mafiaTarget: null, doctorTarget: null, inspectorTarget: null, playerEliminate: null },
    };
  }
  return { ...state, chunk: nextChunk };
}

export function transitionToNight(state) {
  if (state.phase !== PHASES.VOTE && state.phase !== PHASES.NIGHT) {
    throw new Error('Must be in vote or night phase to transition to night');
  }
  return {
    ...state,
    phase: PHASES.NIGHT,
    nightActions: {
      mafiaTarget: null,
      doctorTarget: null,
      inspectorTarget: null,
      playerEliminate: null,
    },
  };
}

export function transitionToDawn(state, nightResult) {
  if (state.phase !== PHASES.NIGHT) {
    throw new Error('Must be in night phase to transition to dawn');
  }
  return {
    ...state,
    phase: PHASES.DAWN,
    lastNightResult: nightResult,
  };
}

export function transitionToDay(state, rng = Math.random) {
  if (state.phase !== PHASES.DAWN) {
    throw new Error('Must be in dawn phase to transition to day');
  }
  const nextDay = state.day + 1;
  const nextState = {
    ...state,
    day: nextDay,
    chunk: 1,
    phase: PHASES.DAY,
    conversationsUsed: 0,
    conversationsAvailable: getConversationsAvailable(state),
    investigationsUsed: 0,
    eliminatedThisVote: null,
  };

  // Re-plan mafia for the new day if poisoning mechanic is active
  let dayState = nextState;
  if (state.mafiaState !== undefined) {
    const withFreshMafiaState = { ...nextState, mafiaState: createDayMafiaState() };
    dayState = { ...withFreshMafiaState, mafiaState: planMafiaDay(withFreshMafiaState) };
  }

  // Generate testimony for new day (uses accumulated knowledge/suspicions)
  const withTestimony = generateAllTestimony(dayState, nextDay, rng);

  // Seed chunk-1 co-presence so NPCs start the day with fresh observations
  return observeNPCCoPresence(withTestimony);
}

export function getConversationsAvailable(state) {
  let base = state.conversationsPerDay || BASE_CONVERSATIONS_PER_DAY;
  // Check if player is allied with journalist
  const journalist = state.characters.find(c => c.role === ROLES.JOURNALIST);
  if (journalist && journalist.alliedWithInspector) {
    base += 1;
  }
  return base;
}

export function setNightAction(state, actionType, targetId) {
  if (state.phase !== PHASES.NIGHT) {
    throw new Error('Can only set night actions during night phase');
  }
  const validActions = ['mafiaTarget', 'doctorTarget', 'inspectorTarget', 'playerEliminate'];
  if (!validActions.includes(actionType)) {
    throw new Error(`Invalid action type: ${actionType}`);
  }
  return {
    ...state,
    nightActions: {
      ...state.nightActions,
      [actionType]: targetId,
    },
  };
}

export function recordConversation(state) {
  if (state.conversationsUsed >= state.conversationsAvailable) {
    throw new Error('No conversation slots remaining');
  }
  return { ...state, conversationsUsed: state.conversationsUsed + 1 };
}

export function updateCharacterInState(state, updatedCharacter) {
  return {
    ...state,
    characters: state.characters.map(c =>
      c.id === updatedCharacter.id ? updatedCharacter : c
    ),
  };
}
