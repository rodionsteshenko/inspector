// Build dynamic system prompts for character LLM conversations

const LOCATION_NAMES = {
  town_square: 'Town Square',
  church:      'Church',
  docks:       'Docks',
  market:      'Market',
  tavern:      'Tavern',
  library:     'Library',
  alley:       'Alley',
  cellar:      'Cellar',
};

function locationName(id) {
  return LOCATION_NAMES[id] || id;
}

/**
 * Build the system prompt for a character conversation.
 * Includes: name, personality, role instructions, movement log, witnessed events.
 * Mafia characters receive deflection instructions; allied characters get role disclosed.
 */
export function buildCharacterSystemPrompt(character, gameState) {
  const { day, chunk } = gameState;
  const { name, personality, role, movementLog, knowledgeState, alliedWithInspector } = character;

  const isMafia = role === 'mafia';
  const isAllied = alliedWithInspector;

  // Movement log — ground truth, character must stay consistent
  const movementDesc = (movementLog || []).length > 0
    ? movementLog.map(e =>
        `  - Day ${e.day}, Chunk ${e.chunk}: at ${locationName(e.location)}`
      ).join('\n')
    : '  (no movements recorded yet)';

  // What the character personally witnessed
  const witnessed = knowledgeState?.witnessed || [];
  const witnessedDesc = witnessed.length > 0
    ? witnessed.slice(-20).map(w => {
        if (w.type === "saw_character") {
          return `  - Day ${w.day}, Chunk ${w.chunk}: saw ${w.subjectName} at ${locationName(w.location)}`;
        }
        return `  - ${w}`;
      }).join("\n")
    : '  (nothing notable observed)';

  // What the character heard secondhand
  const heardFrom = knowledgeState?.heardFrom || [];
  const heardDesc = heardFrom.length > 0
    ? heardFrom.map(h => `  - ${h}`).join('\n')
    : '  (nothing heard from others)';

  // Role-specific behaviour instructions
  let roleSection;
  if (isMafia) {
    roleSection = `
You are secretly a MAFIA member. You and a partner are responsible for the killings in this village.
Behaviour rules — follow them exactly:
- Never admit or hint at your mafia role under any circumstances.
- Sound cooperative and genuinely helpful so you appear innocent.
- You may subtly redirect suspicion toward other villagers, but do it naturally — never obviously.
- If directly accused, deny calmly and firmly. Do not panic, over-explain, or become defensive.
- Never contradict your movement log above. Only claim locations you actually visited.
- Do not reference or coordinate openly with other mafia members during daytime conversations.`;
  } else if (isAllied) {
    roleSection = `
You are a ${role.toUpperCase()} who has formed a mutual alliance with the Inspector.
You trust the Inspector completely. Share everything you know honestly and directly.
Answer all questions truthfully, based only on what you personally witnessed.`;
  } else {
    roleSection = `
You are a ${role.toUpperCase()} — an innocent villager who wants the killers found.
Answer honestly, based only on what you personally witnessed or heard from others.
You do not know who the mafia members are.`;
  }

  return `You are ${name}, a resident of a small village where killings have been occurring.
Personality: ${personality}.

Current time: Day ${day}, Chunk ${chunk} (of 8 chunks per day).

Your actual movements (ground truth — stay consistent with these):
${movementDesc}

What you personally witnessed:
${witnessedDesc}

What you heard from others:
${heardDesc}
${roleSection}

You are speaking with the Inspector, who is investigating the killings.
Respond in character as ${name}. Keep your answer to 2–4 sentences. Match your personality.
Do not break character. Do not mention game rules or mechanics.`;
}

function chunkToTimeOfDay(chunk) {
  if (chunk <= 2) return 'early in the morning';
  if (chunk <= 4) return 'in the late morning';
  if (chunk <= 6) return 'in the afternoon';
  return 'in the evening';
}

/**
 * Build the testimony prompt: instructs LLM to voice pre-generated facts as a natural monologue.
 * The LLM voices the facts — it does not invent them.
 */
export function buildTestimonyPrompt(character, gameState) {
  const { name, personality, testimony = {} } = character;
  const { locationClaims = [], observations = [], suspicions = [] } = testimony;

  const locClaimsText = locationClaims.length > 0
    ? locationClaims.map(c => {
        const timeDesc = chunkToTimeOfDay(c.chunk);
        return `  - I was at ${locationName(c.claimedLocation)} ${timeDesc}`;
      }).join('\n')
    : '  - (no specific location details to share)';

  const obsText = observations.length > 0
    ? observations.map(o => `  - I saw ${o.subjectName} near ${locationName(o.location)}`).join('\n')
    : '  - (no notable sightings)';

  let prompt = `You are ${name}. Personality: ${personality}.

Deliver a natural 3-5 sentence statement to the Inspector containing these facts:

LOCATION CLAIMS (voice these naturally, e.g. "I was at the market midmorning"):
${locClaimsText}

OBSERVATIONS (voice these naturally, e.g. "I spotted Elena near the docks"):
${obsText}`;

  if (suspicions.length > 0) {
    const suspText = suspicions.map(s => `  - ${s.targetName} ${s.reason}`).join('\n');
    prompt += `\n\nSUSPICIONS (weave in naturally):\n${suspText}`;
  }

  prompt += '\n\nStay in character. Do not mention "chunks", "days", or game mechanics. Speak as a villager would to an Inspector.';

  return prompt;
}

/**
 * Build the prompt for generating contextual question suggestions.
 * Factors in: contradictions on evidence board, day number, previously asked questions.
 */
export function buildQuestionsPrompt(character, gameState, askedQuestionTexts = []) {
  const { day, evidenceBoard } = gameState;
  const { name, id } = character;

  const contradictions = (evidenceBoard?.contradictions || []).filter(c => c.characterId === id);
  const hasContradiction = contradictions.length > 0;

  let context = `You are an Inspector investigating murders in a village. You are about to question ${name}.`;

  if (askedQuestionTexts.length > 0) {
    context += `\n\nYou have already asked:\n${askedQuestionTexts.map(q => `- "${q}"`).join('\n')}`;
  }

  if (hasContradiction) {
    context += `\n\nNOTE: You have evidence suggesting ${name} may have lied about their location. Consider pressing on this.`;
  }

  if (day >= 4) {
    context += `\n\nDay ${day} of 5 — the investigation is urgent. Ask specific, pointed questions. You may need to make direct accusations.`;
  } else if (day <= 2) {
    context += `\n\nDay ${day} — early investigation. Ask broad information-gathering questions to learn what people saw.`;
  } else {
    context += `\n\nDay ${day} — mid-investigation. Mix information questions with targeted suspicion questions.`;
  }

  context += `

Generate exactly 4 short, natural detective questions to ask ${name}.
Vary the topics: movements, observations of others, suspicions, unusual behaviour.
Keep each question under 15 words.
Return ONLY the 4 questions, one per line, no numbering, no preamble, no extra text.`;

  return context;
}
