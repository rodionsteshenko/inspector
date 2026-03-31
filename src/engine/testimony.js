// Testimony system: pre-generates what each character will claim in conversations
// LLM voices the testimony — it does not invent it.

import { isMafia } from './roles.js';

const ALL_LOCATIONS = [
  'town_square', 'church', 'docks', 'market', 'tavern', 'library', 'alley', 'cellar',
];

const DEFLECTION_REASONS = [
  'seemed nervous near the docks',
  'was acting strange yesterday',
  'avoided eye contact at the market',
  'left early without explanation',
  'kept looking over their shoulder',
  'disappeared during the commotion',
  'changed their story about where they were',
];

function shuffleCopy(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate testimony for a single character.
 * - Innocent: all locationClaims true, observations from witnessed, no lies.
 * - Mafia: 1-2 locationClaims are lies, 1 deflection suspicion pointing at random innocent.
 */
export function generateTestimony(character, allCharacters, day, rng = Math.random) {
  const { movementLog = [], knowledgeState = {}, role } = character;
  const isMafiaChar = isMafia(role);

  // Build location claims from movement log (default: honest)
  const locationClaims = movementLog.map(entry => ({
    day: entry.day,
    chunk: entry.chunk,
    claimedLocation: entry.location,
    actualLocation: entry.location,
    isLie: false,
  }));

  // Mafia: lie about 1-2 of their location claims
  if (isMafiaChar && locationClaims.length > 0) {
    const maxLies = Math.min(2, locationClaims.length);
    const lieCount = maxLies === 1 ? 1 : Math.floor(rng() * 2) + 1;
    const indices = shuffleCopy([...Array(locationClaims.length).keys()], rng);
    for (let i = 0; i < Math.min(lieCount, indices.length); i++) {
      const idx = indices[i];
      const actualLoc = locationClaims[idx].actualLocation;
      const otherLocs = ALL_LOCATIONS.filter(l => l !== actualLoc);
      const fakeLoc = otherLocs[Math.floor(rng() * otherLocs.length)];
      locationClaims[idx] = { ...locationClaims[idx], claimedLocation: fakeLoc, isLie: true };
    }
  }

  // Observations from personally witnessed events
  const observations = (knowledgeState.witnessed || []).map(w => ({
    subjectId: w.subjectId,
    subjectName: w.subjectName,
    location: w.location,
    day: w.day,
    chunk: w.chunk,
    isTrue: true,
  }));

  // Suspicions: mafia deflects to a random innocent character
  const suspicions = [];
  if (isMafiaChar) {
    const innocents = allCharacters.filter(
      c => !isMafia(c.role) && c.id !== 'player' && c.id !== character.id && c.alive
    );
    if (innocents.length > 0) {
      const target = innocents[Math.floor(rng() * innocents.length)];
      const reason = DEFLECTION_REASONS[Math.floor(rng() * DEFLECTION_REASONS.length)];
      suspicions.push({ targetId: target.id, targetName: target.name, reason });
    }
  }

  return { locationClaims, observations, suspicions };
}

/**
 * Generate and attach testimony to all non-player characters in state.
 * Called at game start and at the beginning of each new day.
 */
export function generateAllTestimony(state, day, rng = Math.random) {
  const updatedCharacters = state.characters.map(character => {
    if (character.id === 'player') return character;
    const testimony = generateTestimony(character, state.characters, day, rng);
    return { ...character, testimony };
  });
  return { ...state, characters: updatedCharacters };
}
