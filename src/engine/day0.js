// Day 0: the murder that happened before you arrived.
// Runs silently off-screen during game creation. The player never sees this play out —
// they walk into a village where someone is already dead.

import { ROLES, isMafia } from './roles.js';
import { getShortestPath } from './map.js';

function getAdj(state) {
  return state.mapConfig?.adjacencyMap || {};
}

/**
 * Run the Day 0 off-screen murder.
 *
 * Steps:
 * 1. Pick a victim — alive, non-mafia, non-player
 * 2. Pick a killer — one of the two mafia members
 * 3. Determine a plausible meeting location for the two mafia (their coordination node)
 * 4. Kill the victim
 * 5. Give characters who were "near" the victim pre-baked witness memories
 * 6. Log the death to the evidence board with day=0
 * 7. Store the day0 murder on state so the reveal screen can display it
 */
export function runDay0Murder(state, rng = Math.random) {
  const { characters } = state;

  const mafiaMembers = characters.filter(c => isMafia(c.role) && c.alive);
  const eligibleVictims = characters.filter(
    c => c.alive && !isMafia(c.role) && c.id !== 'player'
  );

  // Shouldn't happen, but guard anyway
  if (mafiaMembers.length === 0 || eligibleVictims.length === 0) return state;

  // Pick victim (avoid the doctor — makes Day 1 harder in an unfun way)
  const nonDoctorVictims = eligibleVictims.filter(c => c.role !== ROLES.DOCTOR);
  const victimPool = nonDoctorVictims.length > 0 ? nonDoctorVictims : eligibleVictims;
  const victim = victimPool[Math.floor(rng() * victimPool.length)];

  // Pick killer — the mafia member whose starting location is closer to the victim
  const adjacencyMap = getAdj(state);
  let killer = mafiaMembers[0];
  if (mafiaMembers.length >= 2) {
    const distA = pathLength(mafiaMembers[0].location, victim.location, adjacencyMap);
    const distB = pathLength(mafiaMembers[1].location, victim.location, adjacencyMap);
    killer = distA <= distB ? mafiaMembers[0] : mafiaMembers[1];
  }

  // Give 2-3 random innocent NPCs a "saw the victim at their location" memory
  const innocentNpcs = characters.filter(
    c => c.alive && !isMafia(c.role) && c.id !== victim.id && c.id !== 'player'
  );
  const shuffled = shuffle([...innocentNpcs], rng);
  const witnessCount = Math.min(shuffled.length, 2 + Math.floor(rng() * 2)); // 2-3 witnesses
  const witnesses = shuffled.slice(0, witnessCount);

  // Give one witness a "saw the killer near the victim's area" memory (partial evidence)
  const accusingWitness = witnesses.length > 0 ? witnesses[0] : null;

  // Update characters: kill victim, add witness memories
  const updatedCharacters = characters.map(c => {
    if (c.id === victim.id) {
      return { ...c, alive: false };
    }

    if (witnesses.some(w => w.id === c.id)) {
      const isAccuser = accusingWitness && c.id === accusingWitness.id;
      const newWitnessed = [
        {
          type: 'saw_character',
          subjectId: victim.id,
          subjectName: victim.name,
          location: victim.location,
          day: 0,
          chunk: 8,
        },
        // One witness also saw the killer in the vicinity
        ...(isAccuser
          ? [{
              type: 'saw_character',
              subjectId: killer.id,
              subjectName: killer.name,
              location: victim.location,
              day: 0,
              chunk: 7,
            }]
          : []),
      ];
      return {
        ...c,
        knowledgeState: {
          ...c.knowledgeState,
          witnessed: [...(c.knowledgeState?.witnessed || []), ...newWitnessed],
        },
      };
    }

    return c;
  });

  // Add to evidence board
  const day0DeathEntry = {
    characterId: victim.id,
    characterName: victim.name,
    day: 0,
    location: victim.location,
    cause: 'mafia_kill',
  };

  const day0MovementEntries = witnesses.map(w => ({
    characterId: w.id,
    location: victim.location,
    day: 0,
    chunk: 8,
    observedBy: 'witness',
    timestamp: 'Day 0, Chunk 8 (before your arrival)',
  }));

  const updatedEvidenceBoard = {
    ...state.evidenceBoard,
    deathLog: [...state.evidenceBoard.deathLog, day0DeathEntry],
    movementLogs: [...state.evidenceBoard.movementLogs, ...day0MovementEntries],
  };

  return {
    ...state,
    characters: updatedCharacters,
    evidenceBoard: updatedEvidenceBoard,
    day0Murder: {
      victimId: victim.id,
      victimName: victim.name,
      victimLocation: victim.location,
      killerId: killer.id,
      witnesses: witnesses.map(w => ({ id: w.id, name: w.name })),
    },
  };
}

function pathLength(fromId, toId, adjacencyMap) {
  const path = getShortestPath(fromId, toId, adjacencyMap);
  if (!path) return 99;
  return path.length - 1;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
