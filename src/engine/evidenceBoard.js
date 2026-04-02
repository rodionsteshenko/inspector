// Evidence board: contradiction detection, movement log, confirmed roles

export function createEvidenceBoard() {
  return {
    confirmedRoles: {},
    movementLogs: [],
    contradictions: [],
    deathLog: [],
    alliances: [],
    allyObservations: [],
  };
}

export function addMovementLog(board, entry) {
  return {
    ...board,
    movementLogs: [...board.movementLogs, entry],
  };
}

export function addConfirmedRole(board, characterId, role) {
  return {
    ...board,
    confirmedRoles: {
      ...board.confirmedRoles,
      [characterId]: role,
    },
  };
}

export function addDeathLog(board, entry) {
  return {
    ...board,
    deathLog: [...board.deathLog, entry],
  };
}

export function addAlliance(board, characterId) {
  if (board.alliances.includes(characterId)) return board;
  return {
    ...board,
    alliances: [...board.alliances, characterId],
  };
}

// Detect contradiction: character claimed to be at locationA at chunk C,
// but was observed at locationB at chunk C (different location)
export function detectContradiction(board, characterId, claimedLocation, day, chunk) {
  const observed = board.movementLogs.find(
    log => log.characterId === characterId && log.day === day && log.chunk === chunk
  );
  if (!observed) return null;
  if (observed.location !== claimedLocation) {
    return {
      characterId,
      claimedLocation,
      observedLocation: observed.location,
      day,
      chunk,
      description: `${characterId} claimed to be at ${claimedLocation} but was observed at ${observed.location} on Day ${day}, Chunk ${chunk}`,
    };
  }
  return null;
}

// Detect movement impossibility: character claims to be at B at chunk C,
// but was observed at A at chunk C-1, and A and B are not adjacent
export function detectMovementImpossibility(board, characterId, claimedLocation, day, chunk, isAdjacentFn) {
  if (chunk <= 1) return null;
  const prevObservation = board.movementLogs.find(
    log => log.characterId === characterId && log.day === day && log.chunk === chunk - 1
  );
  if (!prevObservation) return null;
  if (prevObservation.location === claimedLocation) return null; // no movement needed

  if (!isAdjacentFn(prevObservation.location, claimedLocation)) {
    return {
      characterId,
      type: 'movement_impossible',
      fromLocation: prevObservation.location,
      toLocation: claimedLocation,
      day,
      chunk,
      description: `${characterId} cannot have reached ${claimedLocation} from ${prevObservation.location} in one chunk`,
    };
  }
  return null;
}

// Run contradiction detection across all movement logs
export function detectAllContradictions(board, characterClaims, isAdjacentFn) {
  const contradictions = [];

  for (const claim of characterClaims) {
    const { characterId, claimedLocation, day, chunk } = claim;

    // Direct contradiction: observed elsewhere at same time
    const direct = detectContradiction(board, characterId, claimedLocation, day, chunk);
    if (direct) contradictions.push(direct);

    // Movement impossibility: can't physically get there in time
    const impossible = detectMovementImpossibility(board, characterId, claimedLocation, day, chunk, isAdjacentFn);
    if (impossible) contradictions.push(impossible);
  }

  return contradictions;
}

export function addContradiction(board, contradiction) {
  // Avoid duplicate contradictions
  const exists = board.contradictions.some(
    c => c.characterId === contradiction.characterId &&
         c.day === contradiction.day &&
         c.chunk === contradiction.chunk &&
         c.type === contradiction.type
  );
  if (exists) return board;
  return {
    ...board,
    contradictions: [...board.contradictions, contradiction],
  };
}

export function getContradictionsForCharacter(board, characterId) {
  return board.contradictions.filter(c => c.characterId === characterId);
}

/**
 * Auto-flag contradictions by comparing claimedFacts (location_claim type)
 * against movementLogs (player observations) AND npcObservations (from conversations).
 * Also cross-references NPC claims against other NPC observations.
 */
export function runContradictionCheck(board) {
  const claimedFacts = board.claimedFacts || [];
  const npcObservations = board.npcObservations || [];
  let updatedBoard = board;

  for (const fact of claimedFacts) {
    if (fact.type !== 'location_claim') continue;
    const { characterId, characterName, location: claimedLocation, day, chunk } = fact;
    if (!characterId || !claimedLocation || !day || !chunk) continue;

    // Check against player's direct observations
    const observed = board.movementLogs.find(
      log => log.characterId === characterId && log.day === day && log.chunk === chunk
    );
    if (observed && observed.location !== claimedLocation) {
      const contradiction = {
        characterId,
        characterName: characterName || characterId,
        claimedLocation,
        observedLocation: observed.location,
        source: 'player_observation',
        day,
        chunk,
        type: 'direct_contradiction',
        description: `${characterName || characterId} claimed to be at ${claimedLocation} but you saw them at ${observed.location} (Day ${day}, Chunk ${chunk})`,
      };
      updatedBoard = addContradiction(updatedBoard, contradiction);
    }

    // Check against other NPCs' testimony observations
    for (const obs of npcObservations) {
      if (obs.subjectId !== characterId) continue;
      if (obs.day !== day || obs.chunk !== chunk) continue;
      if (obs.location === claimedLocation) continue;
      const contradiction = {
        characterId,
        characterName: characterName || characterId,
        claimedLocation,
        observedLocation: obs.location,
        witnessId: obs.witnessId,
        witnessName: obs.witnessName,
        source: 'npc_testimony',
        day,
        chunk,
        type: 'testimony_contradiction',
        description: `${characterName || characterId} claimed to be at ${claimedLocation}, but ${obs.witnessName} saw them at ${obs.location} (Day ${day}, Chunk ${chunk})`,
      };
      updatedBoard = addContradiction(updatedBoard, contradiction);
    }
  }

  return updatedBoard;
}

export function getMovementLogsForCharacter(board, characterId) {
  return board.movementLogs
    .filter(log => log.characterId === characterId)
    .sort((a, b) => a.day - b.day || a.chunk - b.chunk);
}
