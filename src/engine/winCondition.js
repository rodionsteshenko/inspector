// Win/lose condition checks

import { ROLES, isMafia, isInnocent } from './roles.js';
import { MAX_DAYS } from './gameState.js';

export const WIN_STATES = {
  PLAYER_WINS: 'player_wins',
  MAFIA_WINS: 'mafia_wins',
  IN_PROGRESS: 'in_progress',
};

export const LOSE_REASONS = {
  PLAYER_KILLED: 'player_killed',
  MAFIA_PARITY: 'mafia_parity',
  TIME_OUT: 'time_out',
};

// Count alive mafia and alive innocents (including player)
export function countAliveByTeam(characters) {
  const alive = characters.filter(c => c.alive);
  const mafiaCount = alive.filter(c => isMafia(c.role)).length;
  const innocentCount = alive.filter(c => isInnocent(c.role)).length;
  return { mafiaCount, innocentCount, totalAlive: alive.length };
}

// Check if player is alive
export function isPlayerAlive(characters) {
  const player = characters.find(c => c.id === 'player');
  return player ? player.alive : false;
}

// Check if all mafia are eliminated
export function allMafiaEliminated(characters) {
  return characters.filter(c => isMafia(c.role)).every(c => !c.alive);
}

// Check if mafia has reached numerical parity with innocents
// "Mafia reaches numerical parity with innocents" = mafia count >= innocent count (excluding player)
// Effectively: mafia can outvote the rest
export function hasMafiaParity(characters) {
  const { mafiaCount, innocentCount } = countAliveByTeam(characters);
  return mafiaCount >= innocentCount;
}

// Main win condition checker
// Returns { state: WIN_STATES.X, reason: LOSE_REASONS.X | null }
export function checkWinCondition(gameState) {
  const { characters, day, phase } = gameState;

  // Player killed? Only possible via alliance with mafia (formAlliance handles that directly).
  // Mafia cannot target the player during normal night kills.
  if (!isPlayerAlive(characters)) {
    return { state: WIN_STATES.MAFIA_WINS, reason: LOSE_REASONS.PLAYER_KILLED };
  }

  // All mafia eliminated?
  if (allMafiaEliminated(characters)) {
    return { state: WIN_STATES.PLAYER_WINS, reason: 'all_mafia_eliminated' };
  }

  // Mafia parity?
  if (hasMafiaParity(characters)) {
    return { state: WIN_STATES.MAFIA_WINS, reason: LOSE_REASONS.MAFIA_PARITY };
  }

  // Time out: day > maxDays (or MAX_DAYS fallback) and we're past the dawn phase
  const limit = gameState.maxDays || MAX_DAYS;
  if (day > limit) {
    return { state: WIN_STATES.MAFIA_WINS, reason: LOSE_REASONS.TIME_OUT };
  }

  return { state: WIN_STATES.IN_PROGRESS, reason: null };
}

// Apply vote result: eliminate a character, reveal their role
export function applyVoteResult(state, eliminatedCharacterId) {
  const eliminated = state.characters.find(c => c.id === eliminatedCharacterId);
  if (!eliminated) throw new Error(`Character ${eliminatedCharacterId} not found`);
  if (!eliminated.alive) throw new Error(`Character ${eliminatedCharacterId} is already dead`);

  const updatedCharacters = state.characters.map(c => {
    if (c.id === eliminatedCharacterId) {
      return { ...c, alive: false };
    }
    return c;
  });

  // Add to death log with vote cause
  const updatedEvidenceBoard = {
    ...state.evidenceBoard,
    deathLog: [
      ...state.evidenceBoard.deathLog,
      {
        characterId: eliminatedCharacterId,
        characterName: eliminated.name,
        day: state.day,
        location: eliminated.location,
        cause: 'vote',
        revealedRole: eliminated.role,
      },
    ],
    // Also confirm their role
    confirmedRoles: {
      ...state.evidenceBoard.confirmedRoles,
      [eliminatedCharacterId]: eliminated.role,
    },
  };

  return {
    ...state,
    characters: updatedCharacters,
    evidenceBoard: updatedEvidenceBoard,
    eliminatedThisVote: { characterId: eliminatedCharacterId, role: eliminated.role },
  };
}

// AI vote logic: determine how an NPC votes
function getAIVote(npc, state, playerNomination, rng) {
  const aliveTargets = state.characters.filter(
    c => c.alive && c.id !== npc.id && c.id !== 'player'
  );
  if (aliveTargets.length === 0) return playerNomination;

  if (npc.role === ROLES.MAFIA) {
    // Mafia votes for innocents (not their partner)
    const nonMafia = aliveTargets.filter(c => c.role !== ROLES.MAFIA);
    if (nonMafia.length > 0) {
      return nonMafia[Math.floor(rng() * nonMafia.length)].id;
    }
  }

  // 60% chance to follow player nomination
  if (rng() < 0.6) return playerNomination;

  return aliveTargets[Math.floor(rng() * aliveTargets.length)].id;
}

// Calculate vote tally: player nominates someone, NPCs vote based on suspicion
// Returns { votes: { [charId]: count }, winner: charId }
export function calculateVotes(state, playerNomination, rng = Math.random) {
  const aliveNpcs = state.characters.filter(c => c.alive && c.id !== 'player');
  const votes = {};

  // Player's vote for nomination
  votes[playerNomination] = 1;

  // Each NPC casts a vote
  for (const npc of aliveNpcs) {
    const vote = getAIVote(npc, state, playerNomination, rng);
    votes[vote] = (votes[vote] || 0) + 1;
  }

  // Find winner (most votes; ties go to player nomination)
  let maxVotes = 0;
  let winner = playerNomination;
  for (const [id, count] of Object.entries(votes)) {
    if (count > maxVotes) {
      maxVotes = count;
      winner = id;
    }
  }

  return { votes, winner };
}

// Alliance mechanic: mutual reveal between player and a character
export function formAlliance(state, characterId) {
  const character = state.characters.find(c => c.id === characterId);
  if (!character) throw new Error(`Character ${characterId} not found`);
  if (!character.alive) throw new Error('Cannot ally with a dead character');
  const isMafiaCharacter = character.role === ROLES.MAFIA;

  // Allying with mafia = inspector revealed = instant game over
  if (isMafiaCharacter) {
    return {
      ...state,
      gameOver: true,
      winner: 'mafia',
      winReason: 'inspector_revealed',
    };
  }

  // Innocent alliance: dump their knowledge to evidence board
  const allyObservations = (character.knowledgeState?.witnessed || []).map(w => ({
    type: 'ally_observation',
    allyId: characterId,
    allyName: character.name,
    subjectId: w.subjectId,
    subjectName: w.subjectName,
    location: w.location,
    day: w.day,
    chunk: w.chunk,
  }));

  // Also dump testimony observations
  const allyIntel = (character.testimony?.observations || []).map(o => ({
    type: 'ally_observation',
    allyId: characterId,
    allyName: character.name,
    subjectId: o.subjectId,
    subjectName: o.subjectName,
    location: o.location,
    day: o.day,
    chunk: o.chunk,
  }));

  const updatedCharacters = state.characters.map(c => {
    if (c.id === characterId) return { ...c, alliedWithInspector: true };
    return c;
  });

  const updatedEvidenceBoard = {
    ...state.evidenceBoard,
    alliances: [
      ...state.evidenceBoard.alliances,
      {
        characterId,
        characterName: character.name,
        role: character.role,
        day: state.day,
        chunk: state.chunk,
      },
    ],
    confirmedRoles: {
      ...state.evidenceBoard.confirmedRoles,
      [characterId]: character.role,
    },
    allyObservations: [
      ...(state.evidenceBoard.allyObservations || []),
      ...allyObservations,
      ...allyIntel,
    ],
  };

  return {
    ...state,
    characters: updatedCharacters,
    evidenceBoard: updatedEvidenceBoard,
    mafiaKnowsInspector: false,
  };
}
