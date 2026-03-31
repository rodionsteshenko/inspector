// Extract factual claims from LLM character responses and add to the evidence board.
// Runs client-side — no external dependencies.

// Maps lower-case text patterns to location IDs
const LOCATION_TEXT_MAP = {
  'town square': 'town_square',
  'church':      'church',
  'docks':       'docks',
  'dock':        'docks',
  'market':      'market',
  'tavern':      'tavern',
  'library':     'library',
  'alley':       'alley',
  'cellar':      'cellar',
};

// Sentence-start patterns that indicate a location claim by the speaker
const SPEAKER_LOCATION_PREFIXES = [
  'i was at the ',
  'i was at ',
  'i went to the ',
  'i went to ',
  'i visited the ',
  'i visited ',
  'i came from the ',
  'i came from ',
  'at the ',
  'in the ',
];

/**
 * Scan a character's response text for factual claims:
 *   - Location claims ("I was at the tavern")
 *   - Observations about other characters ("Viktor was at the market")
 *
 * Returns an array of fact objects to be appended to evidenceBoard.claimedFacts.
 * Facts are tagged verified=true only when the character has been investigated
 * and found to be innocent (verifiedByInspector && role !== 'mafia').
 */
export function extractFactsFromResponse(responseText, character, gameState) {
  if (!responseText || !character || !gameState) return [];

  const facts = [];
  const lower = responseText.toLowerCase();
  const { day, chunk } = gameState;
  const isVerified = character.verifiedByInspector && character.role !== 'mafia';

  // ── Location claims by the speaking character ────────────────────────────
  let locationClaimFound = false;
  outer:
  for (const [nameText, locationId] of Object.entries(LOCATION_TEXT_MAP)) {
    for (const prefix of SPEAKER_LOCATION_PREFIXES) {
      if (lower.includes(prefix + nameText)) {
        facts.push({
          type: 'location_claim',
          characterId: character.id,
          characterName: character.name,
          location: locationId,
          day,
          chunk,
          verified: isVerified,
          source: responseText.slice(0, 100),
        });
        locationClaimFound = true;
        break outer; // One location fact per response
      }
    }
  }

  // ── Observations about other characters ──────────────────────────────────
  const allChars = gameState.characters || [];
  for (const other of allChars) {
    if (other.id === character.id) continue;

    // Match on first name (e.g. "Brad", "Viktor") — require ≥ 4 chars to avoid false positives
    const firstName = other.name.split(' ')[0].toLowerCase();
    if (firstName.length < 4) continue;
    if (!lower.includes(firstName)) continue;

    // Also check if any location is mentioned alongside the name
    for (const [nameText, locationId] of Object.entries(LOCATION_TEXT_MAP)) {
      if (lower.includes(nameText)) {
        facts.push({
          type: 'observation_claim',
          observerId: character.id,
          observerName: character.name,
          subjectId: other.id,
          subjectName: other.name,
          location: locationId,
          day,
          chunk,
          verified: isVerified,
          source: responseText.slice(0, 100),
        });
        break; // One observation fact per mentioned character
      }
    }
  }

  return facts;
}
