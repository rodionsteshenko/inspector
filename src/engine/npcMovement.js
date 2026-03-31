// NPC AI movement: each chunk, NPCs move one step toward their role goals

import { ROLES } from './roles.js';
import { getAdjacentLocations, MAP_NODES } from './map.js';
import { validateMove, moveCharacter } from './movement.js';
import { getMafiaKillerNextMove, updateMafiaState, createDayMafiaState } from './poisoning.js';

function getPublicLocationIds() {
  return MAP_NODES.filter(n => n.visibility === 'public').map(n => n.id);
}

function pickRandomAdjacent(location, rng) {
  const adj = getAdjacentLocations(location);
  if (adj.length === 0) return null;
  return adj[Math.floor(rng() * adj.length)];
}

// Doctor: gravitates toward public locations, moves around to stay informed
function getDoctorNextMove(character, state, rng) {
  if (rng() > 0.5) return null; // Stay put half the time

  const publicLocs = getPublicLocationIds();
  const adj = getAdjacentLocations(character.location);
  const publicAdj = adj.filter(id => publicLocs.includes(id));

  if (publicAdj.length > 0 && rng() < 0.65) {
    return publicAdj[Math.floor(rng() * publicAdj.length)];
  }

  return pickRandomAdjacent(character.location, rng);
}

// Mason: tries to find a partner to confirm innocence, then behaves like citizen
function getMasonNextMove(character, state, rng) {
  if (rng() > 0.45) return null;
  return pickRandomAdjacent(character.location, rng);
}

// Journalist: social, moves around public areas
function getJournalistNextMove(character, state, rng) {
  if (rng() > 0.55) return null;
  const publicLocs = getPublicLocationIds();
  const adj = getAdjacentLocations(character.location);
  const publicAdj = adj.filter(id => publicLocs.includes(id));
  if (publicAdj.length > 0 && rng() < 0.7) {
    return publicAdj[Math.floor(rng() * publicAdj.length)];
  }
  return pickRandomAdjacent(character.location, rng);
}

// Citizen: semi-random movement, personality-driven
function getCitizenNextMove(character, rng) {
  if (rng() > 0.45) return null; // Stay put often
  return pickRandomAdjacent(character.location, rng);
}

// Get next location for an NPC based on their role
function getNPCNextLocation(character, state, rng) {
  switch (character.role) {
    case ROLES.MAFIA:
      return getMafiaKillerNextMove(character, state, rng);
    case ROLES.DOCTOR:
      return getDoctorNextMove(character, state, rng);
    case ROLES.MASON:
      return getMasonNextMove(character, state, rng);
    case ROLES.JOURNALIST:
      return getJournalistNextMove(character, state, rng);
    case ROLES.CITIZEN:
    default:
      return getCitizenNextMove(character, rng);
  }
}

// Move all alive NPCs one step toward their goals
export function moveNPCs(state, rng = Math.random) {
  let newState = state;
  const npcs = state.characters.filter(c => c.id !== 'player' && c.alive);

  for (const npc of npcs) {
    const nextLocation = getNPCNextLocation(npc, newState, rng);
    if (!nextLocation || nextLocation === npc.location) continue;

    try {
      const validation = validateMove(newState, npc.id, nextLocation);
      if (validation.valid) {
        const prevWitnessedLength = npc.knowledgeState?.witnessed?.length || 0;
        newState = moveCharacter(newState, npc.id, nextLocation);

        // If this NPC is an ally, stream their new observations to the evidence board
        const updatedNpc = newState.characters.find(c => c.id === npc.id);
        if (updatedNpc?.alliedWithInspector) {
          const newWitnesses = (updatedNpc.knowledgeState?.witnessed || []).slice(prevWitnessedLength);
          if (newWitnesses.length > 0) {
            const allyEntries = newWitnesses.map(w => ({
              type: 'ally_observation',
              allyId: npc.id,
              allyName: npc.name,
              subjectId: w.subjectId,
              subjectName: w.subjectName,
              location: w.location,
              day: w.day,
              chunk: w.chunk,
            }));
            newState = {
              ...newState,
              evidenceBoard: {
                ...newState.evidenceBoard,
                allyObservations: [
                  ...(newState.evidenceBoard.allyObservations || []),
                  ...allyEntries,
                ],
              },
            };
          }
        }
      }
    } catch {
      // Skip if move fails
    }
  }

  // Update mafia coordination/poisoning state after movement
  const updatedMafiaState = updateMafiaState(newState, rng);
  newState = { ...newState, mafiaState: updatedMafiaState };

  return newState;
}

// Initialize mafiaState if not present (e.g. on day start)
export function ensureMafiaState(state) {
  if (state.mafiaState) return state;
  return { ...state, mafiaState: createDayMafiaState() };
}
