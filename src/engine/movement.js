// Movement validation and observation logging

import { isAdjacent, isValidLocation, getNodeById, MAP_NODES, ADJACENCY_MAP } from './map.js';
import { getCharactersAtLocation } from './characters.js';

export const MOVE_ERRORS = {
  INVALID_LOCATION: 'INVALID_LOCATION',
  NOT_ADJACENT: 'NOT_ADJACENT',
  PLAYER_DEAD: 'PLAYER_DEAD',
  WRONG_PHASE: 'WRONG_PHASE',
  AT_CAPACITY: 'AT_CAPACITY',
};

function getMapFromState(state) {
  const nodes = state.mapConfig?.nodes || MAP_NODES;
  const adj = state.mapConfig?.adjacencyMap || ADJACENCY_MAP;
  return { nodes, adj };
}

export function validateMove(state, characterId, toLocationId) {
  const { nodes, adj } = getMapFromState(state);
  const character = state.characters.find(c => c.id === characterId);
  if (!character) return { valid: false, error: 'Character not found' };
  if (!character.alive) return { valid: false, error: MOVE_ERRORS.PLAYER_DEAD };
  if (!isValidLocation(toLocationId, nodes)) return { valid: false, error: MOVE_ERRORS.INVALID_LOCATION };
  if (character.location === toLocationId) return { valid: false, error: 'Already at this location' };
  if (!isAdjacent(character.location, toLocationId, adj)) return { valid: false, error: MOVE_ERRORS.NOT_ADJACENT };

  // Check capacity
  const node = getNodeById(toLocationId, nodes);
  const occupants = getCharactersAtLocation(state.characters, toLocationId);
  if (node && occupants.length >= node.capacity) {
    return { valid: false, error: MOVE_ERRORS.AT_CAPACITY };
  }

  return { valid: true, error: null };
}

export function moveCharacter(state, characterId, toLocationId) {
  const validation = validateMove(state, characterId, toLocationId);
  if (!validation.valid) {
    throw new Error(`Invalid move: ${validation.error}`);
  }

  const character = state.characters.find(c => c.id === characterId);
  const atDestination = state.characters.filter(c =>
    c.id !== characterId && c.alive && c.location === toLocationId
  );
  const makeWitness = (subjectId, subjectName, location, day, chunk) => ({
    type: "saw_character", subjectId, subjectName, location, day, chunk,
  });
  const updatedCharacters = state.characters.map(c => {
    if (c.id === characterId) {
      const newWitnessed = atDestination.map(other =>
        makeWitness(other.id, other.name, toLocationId, state.day, state.chunk)
      );
      return {
        ...c,
        location: toLocationId,
        movementLog: [...c.movementLog, { day: state.day, chunk: state.chunk, location: toLocationId }],
        knowledgeState: {
          ...c.knowledgeState,
          witnessed: [...(c.knowledgeState?.witnessed || []), ...newWitnessed],
        },
      };
    }
    if (c.alive && c.location === toLocationId) {
      return {
        ...c,
        knowledgeState: {
          ...c.knowledgeState,
          witnessed: [...(c.knowledgeState?.witnessed || []), makeWitness(characterId, character.name, toLocationId, state.day, state.chunk)],
        },
      };
    }
    return c;
  });

  const newState = {
    ...state,
    characters: updatedCharacters,
  };

  // If moving player, update playerLocation
  if (characterId === 'player') {
    return { ...newState, playerLocation: toLocationId };
  }
  return newState;
}

export function movePlayer(state, toLocationId) {
  if (state.phase !== 'day') {
    throw new Error(MOVE_ERRORS.WRONG_PHASE);
  }
  return moveCharacter(state, 'player', toLocationId);
}

// Generate a tier-2 observation entry: player sees who is at their location
export function generateLocationObservation(state, observingCharacterId) {
  const observer = state.characters.find(c => c.id === observingCharacterId);
  if (!observer) return null;

  const presentCharacters = state.characters.filter(
    c => c.alive && c.location === observer.location && c.id !== observingCharacterId
  );

  return {
    type: 'location_observation',
    observerId: observingCharacterId,
    location: observer.location,
    day: state.day,
    chunk: state.chunk,
    presentCharacterIds: presentCharacters.map(c => c.id),
  };
}

// Generate an interaction observation: character A and B talked
export function generateInteractionObservation({ observerId, actorId, targetId, location, day, chunk, duration = 1 }) {
  return {
    type: 'interaction_observation',
    observerId,
    actorId,
    targetId,
    location,
    day,
    chunk,
    duration,
  };
}

/**
 * After NPCs settle into their chunk positions, each NPC observes everyone else
 * at the same location. This builds their personal knowledge state organically —
 * they notice who is where, who is with whom, and if that seems suspicious given
 * what they already know.
 *
 * This is the feed for persistent NPC belief states — suspicions build up from
 * real observed co-locations, not just fabrications.
 */
export function observeNPCCoPresence(state) {
  const { characters, day, chunk } = state;
  const aliveNpcs = characters.filter(c => c.id !== 'player' && c.alive);

  // Group alive characters by location
  const byLocation = {};
  for (const c of characters.filter(c => c.alive)) {
    if (!byLocation[c.location]) byLocation[c.location] = [];
    byLocation[c.location].push(c);
  }

  // Each NPC observes every other character at their location
  const updatedCharacters = characters.map(npc => {
    if (npc.id === 'player' || !npc.alive) return npc;
    const coLocated = (byLocation[npc.location] || []).filter(c => c.id !== npc.id);
    if (coLocated.length === 0) return npc;

    const newWitnessed = coLocated.map(other => ({
      type: 'saw_character',
      subjectId: other.id,
      subjectName: other.name,
      location: npc.location,
      day,
      chunk,
    }));

    return {
      ...npc,
      knowledgeState: {
        ...npc.knowledgeState,
        witnessed: [...(npc.knowledgeState?.witnessed || []), ...newWitnessed],
      },
    };
  });

  // Also update NPC suspicions based on what they just observed
  const withSuspicions = updateNPCSuspicions(updatedCharacters, state);

  return { ...state, characters: withSuspicions };
}

/**
 * Update each NPC's suspicion list based on their accumulated witnessed events.
 * Suspicions form when:
 * - They see the same two characters together multiple times in private spaces
 * - They see a character near a crime scene location
 * - They see a character they already mildly suspect acting in ways consistent with guilt
 *
 * Suspicions are NOT reset each day — they accumulate and can be revised.
 */
function updateNPCSuspicions(characters, state) {
  const { day0Murder, evidenceBoard } = state;
  const crimeLocation = day0Murder?.victimLocation;
  const deathLocations = new Set(
    (evidenceBoard?.deathLog || []).map(d => d.location).filter(Boolean)
  );

  return characters.map(npc => {
    if (npc.id === 'player' || !npc.alive) return npc;

    const witnessed = npc.knowledgeState?.witnessed || [];
    const existingSuspicions = new Map(
      (npc.suspicions || []).map(s => [s.targetId, s])
    );

    // Count how many times this NPC has seen each other character
    const seenCounts = {};
    const seenAtCrimeLocations = {};
    const locationPairings = {}; // charA+charB at same location

    for (const w of witnessed) {
      if (w.type !== 'saw_character') continue;
      seenCounts[w.subjectId] = (seenCounts[w.subjectId] || 0) + 1;

      // Seen near a crime/death location
      if (crimeLocation && w.location === crimeLocation) {
        seenAtCrimeLocations[w.subjectId] = (seenAtCrimeLocations[w.subjectId] || 0) + 1;
      }
      if (deathLocations.has(w.location)) {
        seenAtCrimeLocations[w.subjectId] = (seenAtCrimeLocations[w.subjectId] || 0) + 1;
      }
    }

    // Detect repeated co-location of two characters (potential mafia coordination)
    for (const w of witnessed) {
      if (w.type !== 'saw_character') continue;
      // Find if npc also saw another character at the same location+chunk
      const coPresent = witnessed.filter(
        w2 => w2.type === 'saw_character' && w2.day === w.day &&
              w2.chunk === w.chunk && w2.location === w.location &&
              w2.subjectId !== w.subjectId
      );
      for (const co of coPresent) {
        const pairKey = [w.subjectId, co.subjectId].sort().join(':');
        locationPairings[pairKey] = (locationPairings[pairKey] || 0) + 1;
      }
    }

    // Build updated suspicion list
    const newSuspicions = [...existingSuspicions.values()];

    // Add suspicion for non-player characters seen near a crime location
    for (const [charId, count] of Object.entries(seenAtCrimeLocations)) {
      if (charId === 'player') continue; // NPCs don't know the inspector's role
      if (count >= 1 && !existingSuspicions.has(charId) && charId !== npc.id) {
        const char = characters.find(c => c.id === charId);
        if (char && char.alive) {
          const victimName = day0Murder?.victimName || 'the victim';
          const locationLabel = day0Murder?.victimLocation?.replace('_', ' ') || 'the crime scene';
          newSuspicions.push({
            targetId: charId,
            targetName: char.name,
            reason: `was at the ${locationLabel} around the time ${victimName} was killed`,
            source: 'observed',
            strength: count,
          });
          existingSuspicions.set(charId, newSuspicions[newSuspicions.length - 1]);
        }
      } else if (count >= 2 && existingSuspicions.has(charId)) {
        const idx = newSuspicions.findIndex(s => s.targetId === charId);
        if (idx >= 0) newSuspicions[idx] = { ...newSuspicions[idx], strength: count };
      }
    }

    return { ...npc, suspicions: newSuspicions };
  });
}

// Log a movement observation to the evidence board
export function logMovementToEvidence(evidenceBoard, characterId, location, day, chunk, observedBy) {
  const entry = {
    characterId,
    location,
    day,
    chunk,
    observedBy,
    timestamp: `Day ${day}, Chunk ${chunk}`,
  };
  return {
    ...evidenceBoard,
    movementLogs: [...evidenceBoard.movementLogs, entry],
  };
}
