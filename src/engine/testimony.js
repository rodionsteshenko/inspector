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
 * Identify which movement log entries are "incriminating" for a mafia member —
 * the chunks where they were at the meeting node with their partner, or
 * approaching the target. These are what they need to hide.
 */
function getIncriminatingChunks(character, allCharacters, mafiaState) {
  if (!mafiaState) return new Set();
  const incriminating = new Set();
  const mafiaPartner = allCharacters.find(
    c => isMafia(c.role) && c.id !== character.id && c.alive
  );

  // Chunks where they were at the same location as their partner (coordination)
  if (mafiaPartner) {
    for (const entry of character.movementLog || []) {
      const partnerEntry = (mafiaPartner.movementLog || []).find(
        e => e.day === entry.day && e.chunk === entry.chunk
      );
      if (partnerEntry && partnerEntry.location === entry.location) {
        // Private/semi-private location together = especially incriminating
        incriminating.add(`${entry.day}-${entry.chunk}`);
      }
    }
  }

  // Chunks where they were at the same location as the target (poisoning)
  if (mafiaState.target && mafiaState.target !== 'player') {
    const target = allCharacters.find(c => c.id === mafiaState.target);
    if (target) {
      for (const entry of character.movementLog || []) {
        const targetEntry = (target.movementLog || []).find(
          e => e.day === entry.day && e.chunk === entry.chunk
        );
        if (targetEntry && targetEntry.location === entry.location) {
          incriminating.add(`${entry.day}-${entry.chunk}`);
        }
      }
    }
  }

  return incriminating;
}

/**
 * Generate testimony for a single character.
 *
 * Innocents: fully truthful location claims and observations.
 *
 * Mafia: Deception is behavioral, not blanket fabrication:
 *   - Location claims are OMITTED for incriminating chunks (meeting partner,
 *     approaching victim). They don't lie about where they were — they just
 *     don't mention those moments. A missing chunk is harder to catch than a
 *     false one.
 *   - If forced to address an incriminating chunk (player asks directly), only
 *     THEN do they lie — replacing it with a plausible innocent location nearby.
 *   - Observations: they suppress seeing their partner. They may fabricate
 *     seeing an innocent at a suspicious location to redirect attention.
 *   - Suspicions: always deflect toward a specific innocent with a plausible reason.
 */
export function generateTestimony(character, allCharacters, day, rng = Math.random, mafiaState = null, day0Murder = null) {
  const { movementLog = [], knowledgeState = {}, role } = character;
  const isMafiaChar = isMafia(role);

  // Find mafia partner (for suppression logic)
  const mafiaPartner = isMafiaChar
    ? allCharacters.find(c => isMafia(c.role) && c.id !== character.id && c.alive)
    : null;

  const incriminatingChunks = isMafiaChar
    ? getIncriminatingChunks(character, allCharacters, mafiaState)
    : new Set();

  // Also flag any chunk where killer was at the Day 0 murder location
  if (isMafiaChar && day0Murder && day0Murder.killerId === character.id) {
    for (const entry of movementLog) {
      if (entry.location === day0Murder.victimLocation && entry.day <= 1) {
        incriminatingChunks.add(`${entry.day}-${entry.chunk}`);
      }
    }
  }

  // Mafia: if no chunks were flagged as incriminating (e.g. no mafiaState yet),
  // still lie about ~40% of location claims to avoid being fully truthful.
  if (isMafiaChar && incriminatingChunks.size === 0 && movementLog.length > 0) {
    for (const entry of movementLog) {
      if (rng() < 0.4) {
        incriminatingChunks.add(`${entry.day}-${entry.chunk}`);
      }
    }
    // Guarantee at least one lie if there are entries
    if (incriminatingChunks.size === 0) {
      const entry = movementLog[0];
      incriminatingChunks.add(`${entry.day}-${entry.chunk}`);
    }
  }

  // Build location claims
  const locationClaims = [];
  for (const entry of movementLog) {
    const key = `${entry.day}-${entry.chunk}`;
    const isIncriminating = incriminatingChunks.has(key);

    if (isMafiaChar && isIncriminating) {
      // Omit this chunk from volunteered testimony — silence is less detectable than lies.
      // Mark it so the prompt knows NOT to volunteer this time slot.
      // If directly pressed, they'll claim a nearby public location (the lie is lazy and plausible).
      const publicLocs = ['town_square', 'market', 'church', 'docks', 'tavern'];
      const nearbyPublic = publicLocs.filter(l => l !== entry.location);
      const coverStory = nearbyPublic[Math.floor(rng() * nearbyPublic.length)];
      locationClaims.push({
        day: entry.day,
        chunk: entry.chunk,
        claimedLocation: coverStory,    // only used if directly asked
        actualLocation: entry.location,
        isLie: true,
        isOmitted: true,                // don't volunteer this — skip in normal testimony
      });
    } else {
      locationClaims.push({
        day: entry.day,
        chunk: entry.chunk,
        claimedLocation: entry.location,
        actualLocation: entry.location,
        isLie: false,
        isOmitted: false,
      });
    }
  }

  // Observations: what this character actually witnessed
  const witnessed = knowledgeState.witnessed || [];
  const observations = witnessed
    .filter(w => {
      // Mafia: suppress observations of their partner (would implicate coordination)
      if (isMafiaChar && mafiaPartner && w.subjectId === mafiaPartner.id) return false;
      return true;
    })
    .map(w => ({
      subjectId: w.subjectId,
      subjectName: w.subjectName,
      location: w.location,
      day: w.day,
      chunk: w.chunk,
      isTrue: true,
    }));

  // Mafia: inject a fabricated observation — an innocent at a slightly suspicious location
  // This gives the player a false trail to follow.
  if (isMafiaChar) {
    const innocents = allCharacters.filter(
      c => !isMafia(c.role) && c.id !== 'player' && c.id !== character.id && c.alive
    );
    if (innocents.length > 0) {
      const decoyTarget = innocents[Math.floor(rng() * innocents.length)];
      // Pick a semi-private location the decoy may plausibly have visited
      const suspiciousLocs = ['alley', 'cellar', 'library', 'tavern'];
      const fakeLoc = suspiciousLocs[Math.floor(rng() * suspiciousLocs.length)];
      observations.push({
        subjectId: decoyTarget.id,
        subjectName: decoyTarget.name,
        location: fakeLoc,
        day,
        chunk: 3 + Math.floor(rng() * 3), // mid-day, plausible
        isTrue: false,   // fabricated — for LLM context, not contradiction detection
        isFabricated: true,
      });
    }
  }

  // Suspicions: mafia always has a specific deflection target with a behavioral reason
  // Innocents may have genuine suspicions if they witnessed something odd
  const suspicions = [];
  if (isMafiaChar) {
    const innocents = allCharacters.filter(
      c => !isMafia(c.role) && c.id !== 'player' && c.id !== character.id && c.alive
    );
    if (innocents.length > 0) {
      const target = innocents[Math.floor(rng() * innocents.length)];
      const reason = DEFLECTION_REASONS[Math.floor(rng() * DEFLECTION_REASONS.length)];
      suspicions.push({ targetId: target.id, targetName: target.name, reason, isFabricated: true });
    }
  }

  return { locationClaims, observations, suspicions };
}

const LOCATION_LABELS = {
  town_square: 'the town square', church: 'the church', docks: 'the docks',
  market: 'the market', tavern: 'the tavern', library: 'the library',
  alley: 'the alley', cellar: 'the cellar',
};

function loc(id) { return LOCATION_LABELS[id] || id.replace('_', ' '); }

function chunkTime(chunk) {
  if (chunk <= 2) return 'early morning';
  if (chunk <= 4) return 'late morning';
  if (chunk <= 6) return 'afternoon';
  return 'evening';
}

/**
 * Build a deterministic conversation script from testimony data.
 * Returns an array of { speaker: 'inspector'|characterName, text: string } exchanges.
 *
 * The Inspector asks questions; the NPC answers based on their testimony facts.
 * This serves as both the LLM prompt input (what facts to cover) and the
 * offline fallback if the LLM is unavailable.
 *
 * Innocents: straightforward, share what they saw.
 * Mafia: omit incriminating info, deflect, maybe fabricate a sighting.
 */
export function generateConversationScript(character, gameState) {
  const { testimony = {}, name, suspicions: npcSuspicions = [] } = character;
  const { locationClaims = [], observations = [], suspicions: testimonySuspicions = [] } = testimony;
  const { day0Murder, day } = gameState;

  const exchanges = [];

  // --- Exchange 1: Murder context (Day 1) or general check-in (later days) ---
  if (day <= 1 && day0Murder) {
    exchanges.push(
      { speaker: 'inspector', text: `${name}, I need to ask you about ${day0Murder.victimName}'s death. Where were you when it happened?` },
    );

    // NPC responds with their earliest location claims
    const earlyClaims = locationClaims.filter(c => !c.isOmitted && c.day <= 1).slice(0, 2);
    if (earlyClaims.length > 0) {
      const claimText = earlyClaims.map(c =>
        `I was at ${loc(c.claimedLocation)} ${chunkTime(c.chunk)}`
      ).join(', and ');
      exchanges.push({ speaker: name, text: `${claimText}. I had nothing to do with what happened to ${day0Murder.victimName}.` });
    } else {
      exchanges.push({ speaker: name, text: `I... I was around the village. It's all a blur after hearing about ${day0Murder.victimName}.` });
    }
  } else {
    exchanges.push(
      { speaker: 'inspector', text: `${name}, tell me about your day. Where have you been?` },
    );

    const todayClaims = locationClaims.filter(c => !c.isOmitted && c.day === day).slice(0, 3);
    if (todayClaims.length > 0) {
      const claimText = todayClaims.map(c =>
        `${loc(c.claimedLocation)} ${chunkTime(c.chunk)}`
      ).join(', then ');
      exchanges.push({ speaker: name, text: `I've been at ${claimText}. Just going about my usual business.` });
    } else {
      exchanges.push({ speaker: name, text: `I've been keeping to myself, mostly. Staying close to home.` });
    }
  }

  // --- Exchange 2: What did you see? ---
  const relevantObs = observations.filter(o => o.day === day || (day <= 1 && o.day <= 1));
  const uniqueObs = [];
  const seenSubjects = new Set();
  for (const o of relevantObs) {
    if (!seenSubjects.has(o.subjectId)) {
      uniqueObs.push(o);
      seenSubjects.add(o.subjectId);
    }
  }
  const reportableObs = uniqueObs.slice(0, 3);

  if (reportableObs.length > 0) {
    exchanges.push(
      { speaker: 'inspector', text: `Did you notice anyone else while you were out?` },
    );
    const obsParts = reportableObs.map(o =>
      `I saw ${o.subjectName} at ${loc(o.location)}${o.isFabricated ? '' : ` around ${chunkTime(o.chunk)}`}`
    );
    exchanges.push({ speaker: name, text: obsParts.join('. ') + '.' });
  }

  // --- Exchange 3: Suspicions ---
  const allSuspicions = [...(npcSuspicions || []), ...testimonySuspicions];
  const suspicionMap = new Map();
  for (const s of allSuspicions) {
    if (!suspicionMap.has(s.targetId)) suspicionMap.set(s.targetId, s);
  }
  const topSuspicions = [...suspicionMap.values()].slice(0, 2);

  if (topSuspicions.length > 0) {
    exchanges.push(
      { speaker: 'inspector', text: `Do you have any idea who might be behind this?` },
    );
    const suspTexts = topSuspicions.map(s => `${s.targetName} — ${s.reason}`);
    exchanges.push({ speaker: name, text: `I don't want to point fingers, but... ${suspTexts.join('. Also, ')}.` });
  }

  // --- Exchange 4: Day 0 witness info (if applicable) ---
  if (day0Murder) {
    const witnessed = character.knowledgeState?.witnessed || [];
    const sawKiller = witnessed.find(w => w.subjectId === day0Murder.killerId && w.day === 0);
    const sawVictim = witnessed.find(w => w.subjectId === day0Murder.victimId && w.day === 0);

    if (sawKiller && character.id !== day0Murder.killerId) {
      const killerChar = gameState.characters.find(c => c.id === day0Murder.killerId);
      const killerName = killerChar?.name || 'someone';
      // Mafia won't mention seeing the killer if it's their partner
      const isMafiaChar = isMafia(character.role);
      const isMafiaPartner = isMafiaChar && isMafia(killerChar?.role);
      if (!isMafiaPartner) {
        exchanges.push(
          { speaker: 'inspector', text: `Did you see anything unusual near ${loc(day0Murder.victimLocation)}?` },
          { speaker: name, text: `Actually, yes. I noticed ${killerName} near ${loc(day0Murder.victimLocation)} around that time. I didn't think much of it then, but now...` },
        );
      }
    } else if (sawVictim && character.id !== day0Murder.killerId) {
      exchanges.push(
        { speaker: 'inspector', text: `Did you see ${day0Murder.victimName} before it happened?` },
        { speaker: name, text: `Yes, I saw them at ${loc(day0Murder.victimLocation)}. They seemed fine. I wish I'd stayed longer — maybe I could have...` },
      );
    }
  }

  // --- Closing ---
  exchanges.push(
    { speaker: 'inspector', text: `Thank you, ${name}. Stay safe.` },
    { speaker: name, text: `Be careful out there, Registrar. I don't think we've seen the last of this.` },
  );

  return exchanges;
}

/**
 * Generate and attach testimony to all non-player characters in state.
 * Called at game start and at the beginning of each new day.
 */
export function generateAllTestimony(state, day, rng = Math.random) {
  const updatedCharacters = state.characters.map(character => {
    if (character.id === 'player') return character;
    const testimony = generateTestimony(
      character, state.characters, day, rng,
      state.mafiaState || null,
      state.day0Murder || null
    );
    return { ...character, testimony };
  });
  return { ...state, characters: updatedCharacters };
}
