// Movement validation and observation logging

import { isAdjacent, isValidLocation, getNodeById } from './map.js';
import { getCharactersAtLocation } from './characters.js';

export const MOVE_ERRORS = {
  INVALID_LOCATION: 'INVALID_LOCATION',
  NOT_ADJACENT: 'NOT_ADJACENT',
  PLAYER_DEAD: 'PLAYER_DEAD',
  WRONG_PHASE: 'WRONG_PHASE',
  AT_CAPACITY: 'AT_CAPACITY',
};

export function validateMove(state, characterId, toLocationId) {
  const character = state.characters.find(c => c.id === characterId);
  if (!character) return { valid: false, error: 'Character not found' };
  if (!character.alive) return { valid: false, error: MOVE_ERRORS.PLAYER_DEAD };
  if (!isValidLocation(toLocationId)) return { valid: false, error: MOVE_ERRORS.INVALID_LOCATION };
  if (character.location === toLocationId) return { valid: false, error: 'Already at this location' };
  if (!isAdjacent(character.location, toLocationId)) return { valid: false, error: MOVE_ERRORS.NOT_ADJACENT };

  // Check capacity
  const node = getNodeById(toLocationId);
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
