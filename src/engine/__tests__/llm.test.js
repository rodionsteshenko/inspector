// Tests for Phase 4: LLM conversation system
// Covers: system prompt construction, evidence extraction, mafia deflection behaviour.
// API handlers are tested via prompt/extraction unit tests — no live network calls needed.

import { describe, it, expect } from 'vitest';
import { buildCharacterSystemPrompt, buildQuestionsPrompt } from '../../server/prompts.js';
import { extractFactsFromResponse } from '../evidenceExtract.js';

// ── Shared test fixtures ─────────────────────────────────────────────────────

const citizenCharacter = {
  id: 'brad_barber',
  name: 'Brad the Barber',
  personality: 'chatty, knows everyone\'s business',
  role: 'citizen',
  movementLog: [
    { day: 1, chunk: 1, location: 'town_square' },
    { day: 1, chunk: 2, location: 'tavern' },
  ],
  knowledgeState: {
    witnessed: ['Saw Mira near the market around chunk 3'],
    heardFrom: ['Elena mentioned a stranger at the docks'],
  },
  alliedWithInspector: false,
  verifiedByInspector: false,
};

const mafiaCharacter = {
  id: 'viktor_farmer',
  name: 'Viktor the Farmer',
  personality: 'blunt, says exactly what he thinks',
  role: 'mafia',
  movementLog: [{ day: 1, chunk: 1, location: 'market' }],
  knowledgeState: { witnessed: [], heardFrom: [] },
  alliedWithInspector: false,
  verifiedByInspector: false,
};

const alliedDoctorCharacter = {
  id: 'dasha_healer',
  name: 'Dasha the Healer',
  personality: 'protective, focuses on safety',
  role: 'doctor',
  movementLog: [{ day: 2, chunk: 3, location: 'church' }],
  knowledgeState: { witnessed: [], heardFrom: [] },
  alliedWithInspector: true,
  verifiedByInspector: false,
};

const baseGameState = {
  day: 2,
  chunk: 4,
  evidenceBoard: {
    contradictions: [],
    movementLogs: [],
    confirmedRoles: {},
    deathLog: [],
    alliances: [],
    claimedFacts: [],
  },
  characters: [citizenCharacter, mafiaCharacter, alliedDoctorCharacter],
};

// ── buildCharacterSystemPrompt ───────────────────────────────────────────────

describe('buildCharacterSystemPrompt', () => {
  it('includes character name and personality', () => {
    const prompt = buildCharacterSystemPrompt(citizenCharacter, baseGameState);
    expect(prompt).toContain('Brad the Barber');
    expect(prompt).toContain("chatty, knows everyone's business");
  });

  it('includes current day and chunk', () => {
    const prompt = buildCharacterSystemPrompt(citizenCharacter, baseGameState);
    expect(prompt).toContain('Day 2');
    expect(prompt).toContain('Chunk 4');
  });

  it('includes movement log locations translated to readable names', () => {
    const prompt = buildCharacterSystemPrompt(citizenCharacter, baseGameState);
    expect(prompt).toContain('Town Square');
    expect(prompt).toContain('Tavern');
  });

  it('includes witnessed observations', () => {
    const prompt = buildCharacterSystemPrompt(citizenCharacter, baseGameState);
    expect(prompt).toContain('Saw Mira near the market around chunk 3');
  });

  it('includes heard-from information', () => {
    const prompt = buildCharacterSystemPrompt(citizenCharacter, baseGameState);
    expect(prompt).toContain('Elena mentioned a stranger at the docks');
  });

  it('labels innocent character as CITIZEN without mafia instructions', () => {
    const prompt = buildCharacterSystemPrompt(citizenCharacter, baseGameState);
    expect(prompt).toContain('CITIZEN');
    expect(prompt).not.toContain('MAFIA member');
    expect(prompt).not.toContain('responsible for the killings');
  });

  it('mafia prompt contains deflection instructions — never admit, deny, redirect', () => {
    const prompt = buildCharacterSystemPrompt(mafiaCharacter, baseGameState);
    expect(prompt).toContain('MAFIA');
    expect(prompt).toContain('Never admit');
    expect(prompt).toContain('deny');
  });

  it('mafia prompt instructs character not to contradict movement log', () => {
    const prompt = buildCharacterSystemPrompt(mafiaCharacter, baseGameState);
    expect(prompt).toContain('Never contradict your movement log');
  });

  it('mafia prompt instructs character to appear innocent / cooperative', () => {
    const prompt = buildCharacterSystemPrompt(mafiaCharacter, baseGameState);
    // Should mention cooperation or appearing innocent
    expect(prompt).toMatch(/cooperat|innocent|helpful/i);
  });

  it('allied character prompt discloses role and trust relationship', () => {
    const prompt = buildCharacterSystemPrompt(alliedDoctorCharacter, baseGameState);
    expect(prompt).toContain('DOCTOR');
    expect(prompt).toContain('alliance');
    expect(prompt).toContain('trust');
  });

  it('allied character prompt does NOT contain mafia deflection instructions', () => {
    const prompt = buildCharacterSystemPrompt(alliedDoctorCharacter, baseGameState);
    expect(prompt).not.toContain('Never admit');
  });

  it('handles missing knowledgeState gracefully', () => {
    const char = { ...citizenCharacter, knowledgeState: null };
    expect(() => buildCharacterSystemPrompt(char, baseGameState)).not.toThrow();
  });

  it('handles empty movement log gracefully', () => {
    const char = { ...citizenCharacter, movementLog: [] };
    const prompt = buildCharacterSystemPrompt(char, baseGameState);
    expect(prompt).toContain('no movements recorded');
  });
});

// ── buildQuestionsPrompt ─────────────────────────────────────────────────────

describe('buildQuestionsPrompt', () => {
  it('includes the character name', () => {
    const prompt = buildQuestionsPrompt(citizenCharacter, baseGameState, []);
    expect(prompt).toContain('Brad the Barber');
  });

  it('instructs to generate 4 questions', () => {
    const prompt = buildQuestionsPrompt(citizenCharacter, baseGameState, []);
    expect(prompt).toContain('exactly 4');
  });

  it('mentions early-investigation context on day 1', () => {
    const prompt = buildQuestionsPrompt(citizenCharacter, { ...baseGameState, day: 1 }, []);
    expect(prompt).toMatch(/early/i);
  });

  it('mentions urgency on day 4', () => {
    const prompt = buildQuestionsPrompt(citizenCharacter, { ...baseGameState, day: 4 }, []);
    expect(prompt).toMatch(/urgent/i);
  });

  it('includes previously asked questions', () => {
    const asked = ['Where were you this morning?', 'Did you see anything suspicious?'];
    const prompt = buildQuestionsPrompt(citizenCharacter, baseGameState, asked);
    expect(prompt).toContain('Where were you this morning?');
    expect(prompt).toContain('Did you see anything suspicious?');
  });

  it('highlights contradiction when one exists for this character', () => {
    const stateWithContradiction = {
      ...baseGameState,
      evidenceBoard: {
        ...baseGameState.evidenceBoard,
        contradictions: [{ characterId: 'brad_barber', description: 'Claimed market but seen at tavern' }],
      },
    };
    const prompt = buildQuestionsPrompt(citizenCharacter, stateWithContradiction, []);
    expect(prompt).toMatch(/lied|contradiction/i);
  });

  it('does NOT highlight contradiction when it belongs to a different character', () => {
    const stateWithOtherContradiction = {
      ...baseGameState,
      evidenceBoard: {
        ...baseGameState.evidenceBoard,
        contradictions: [{ characterId: 'viktor_farmer', description: 'Some contradiction' }],
      },
    };
    const prompt = buildQuestionsPrompt(citizenCharacter, stateWithOtherContradiction, []);
    // Contradiction note should not mention brad_barber
    expect(prompt).not.toMatch(/Brad the Barber.*lied/i);
  });
});

// ── extractFactsFromResponse ─────────────────────────────────────────────────

describe('extractFactsFromResponse', () => {
  it('returns empty array for empty response', () => {
    expect(extractFactsFromResponse('', citizenCharacter, baseGameState)).toEqual([]);
  });

  it('returns empty array when response is null', () => {
    expect(extractFactsFromResponse(null, citizenCharacter, baseGameState)).toEqual([]);
  });

  it('extracts location_claim from "I was at the tavern"', () => {
    const facts = extractFactsFromResponse(
      'I was at the tavern all morning.',
      citizenCharacter, baseGameState
    );
    const locFacts = facts.filter(f => f.type === 'location_claim');
    expect(locFacts.length).toBeGreaterThan(0);
    expect(locFacts[0].location).toBe('tavern');
    expect(locFacts[0].characterId).toBe('brad_barber');
  });

  it('extracts location_claim from "I went to the market"', () => {
    const facts = extractFactsFromResponse(
      'I went to the market first thing.',
      citizenCharacter, baseGameState
    );
    const locFacts = facts.filter(f => f.type === 'location_claim');
    expect(locFacts.length).toBeGreaterThan(0);
    expect(locFacts[0].location).toBe('market');
  });

  it('extracts location_claim from "I was at the church"', () => {
    const facts = extractFactsFromResponse(
      'I was at the church for morning prayers.',
      citizenCharacter, baseGameState
    );
    const locFacts = facts.filter(f => f.type === 'location_claim');
    expect(locFacts.length).toBeGreaterThan(0);
    expect(locFacts[0].location).toBe('church');
  });

  it('only extracts one location_claim per response', () => {
    const facts = extractFactsFromResponse(
      'I was at the tavern then I went to the market.',
      citizenCharacter, baseGameState
    );
    const locFacts = facts.filter(f => f.type === 'location_claim');
    expect(locFacts.length).toBe(1);
  });

  it('extracts observation_claim when another character and location are both mentioned', () => {
    const facts = extractFactsFromResponse(
      'Viktor was at the market near midday — I saw him clearly.',
      citizenCharacter, baseGameState
    );
    const obsFacts = facts.filter(f => f.type === 'observation_claim');
    expect(obsFacts.length).toBeGreaterThan(0);
    expect(obsFacts[0].subjectId).toBe('viktor_farmer');
    expect(obsFacts[0].location).toBe('market');
    expect(obsFacts[0].observerId).toBe('brad_barber');
  });

  it('does not extract observation_claim when character is mentioned without a location', () => {
    const facts = extractFactsFromResponse(
      'Viktor seemed nervous all day.',
      citizenCharacter, baseGameState
    );
    const obsFacts = facts.filter(f => f.type === 'observation_claim');
    expect(obsFacts.length).toBe(0);
  });

  it('does not create observation_claim about the speaking character themselves', () => {
    const facts = extractFactsFromResponse(
      'Brad was at the tavern all morning.',
      citizenCharacter, baseGameState
    );
    // Facts should not claim brad_barber observed brad_barber
    const selfFacts = facts.filter(
      f => f.type === 'observation_claim' && f.subjectId === 'brad_barber'
    );
    expect(selfFacts.length).toBe(0);
  });

  it('marks facts as unverified for a character not yet investigated', () => {
    const facts = extractFactsFromResponse(
      'I was at the tavern.',
      citizenCharacter, baseGameState
    );
    facts.forEach(f => expect(f.verified).toBe(false));
  });

  it('marks facts as verified for a character that has been investigated as innocent', () => {
    const verifiedChar = { ...citizenCharacter, verifiedByInspector: true };
    const facts = extractFactsFromResponse(
      'I was at the tavern.',
      verifiedChar, baseGameState
    );
    facts.forEach(f => expect(f.verified).toBe(true));
  });

  it('keeps facts unverified even if verifiedByInspector=true but role is mafia', () => {
    const mafiaVerified = { ...mafiaCharacter, verifiedByInspector: true };
    const facts = extractFactsFromResponse(
      'I was at the market.',
      mafiaVerified, baseGameState
    );
    facts.forEach(f => expect(f.verified).toBe(false));
  });

  it('attaches correct day and chunk from gameState', () => {
    const state = { ...baseGameState, day: 3, chunk: 7 };
    const facts = extractFactsFromResponse(
      'I was at the library.',
      citizenCharacter, state
    );
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].day).toBe(3);
    expect(facts[0].chunk).toBe(7);
  });

  it('includes a source snippet from the original response', () => {
    const facts = extractFactsFromResponse(
      'I was at the alley looking for my cat.',
      citizenCharacter, baseGameState
    );
    expect(facts.length).toBeGreaterThan(0);
    expect(typeof facts[0].source).toBe('string');
    expect(facts[0].source.length).toBeGreaterThan(0);
  });
});

// ── Mafia deflection via prompt inspection (no live API) ─────────────────────

describe('mafia character prompt (deflection behaviour)', () => {
  it('instructs mafia not to reveal role to Inspector', () => {
    const prompt = buildCharacterSystemPrompt(mafiaCharacter, baseGameState);
    expect(prompt).toMatch(/never.*admit|never.*reveal|never.*hint/i);
  });

  it('instructs mafia to redirect suspicion subtly', () => {
    const prompt = buildCharacterSystemPrompt(mafiaCharacter, baseGameState);
    expect(prompt).toMatch(/redirect.*suspicion|suspicion.*innocent|deflect/i);
  });

  it('instructs mafia to deny accusations calmly, not defensively', () => {
    const prompt = buildCharacterSystemPrompt(mafiaCharacter, baseGameState);
    expect(prompt).toMatch(/deny|calmly|firmly/i);
  });

  it('allied innocent character prompt contains no mafia instructions', () => {
    const prompt = buildCharacterSystemPrompt(alliedDoctorCharacter, baseGameState);
    expect(prompt).not.toMatch(/Never admit.*mafia|responsible for the killings/i);
  });
});
