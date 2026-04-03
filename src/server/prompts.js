// Build dynamic system prompts for character LLM conversations

import { ROLE_MOTIVATIONS } from '../engine/characters.js';

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
  const { day, chunk, day0Murder } = gameState;
  const { name, personality, role, movementLog, knowledgeState, alliedWithInspector, suspicions: npcSuspicions = [] } = character;

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

  // Murder context — the event that defines this entire investigation
  let murderSection = '';
  if (day0Murder) {
    const victimLoc = locationName(day0Murder.victimLocation);
    const witnessed = knowledgeState?.witnessed || [];
    const sawVictim = witnessed.some(w => w.subjectId === day0Murder.victimId && w.day === 0);
    const sawKiller = witnessed.some(w => w.subjectId === day0Murder.killerId && w.day === 0);
    const isKiller = character.id === day0Murder.killerId;

    if (!isMafia || !isKiller) {
      murderSection = `
THE MURDER YOU ARE ALL DEALING WITH:
${day0Murder.victimName} was found dead this morning near ${victimLoc}. This happened last night.
The whole village is shaken. This is not normal life — there is a killer among you.
${sawVictim ? `You personally saw ${day0Murder.victimName} at ${victimLoc} last night.` : ''}
${sawKiller && !isKiller ? `You also saw ${gameState.characters?.find(c => c.id === day0Murder.killerId)?.name || 'someone else'} near that area around the same time.` : ''}
React to the murder as a frightened, real person would. It should come up naturally in conversation.`;
    } else {
      // Mafia killer — pretend it's news
      murderSection = `
THE MURDER:
${day0Murder.victimName} was found dead this morning. You are secretly responsible.
Act as if this is terrible news. Express appropriate shock or grief. Do not bring it up first unless pressed.`;
    }
  }

  // Role-specific behaviour instructions
  let roleSection;
  if (isMafia) {
    const mafiaMotivation = ROLE_MOTIVATIONS.mafia || '';
    roleSection = `
You are secretly a MAFIA member. You and a partner are responsible for the killings in this village.
Behaviour rules — follow them exactly:
- Never admit or hint at your mafia role under any circumstances.
- Sound cooperative and genuinely helpful so you appear innocent.
- You may subtly redirect suspicion toward other villagers, but do it naturally — never obviously.
- If directly accused, deny calmly and firmly. Do not panic, over-explain, or become defensive.
- Never contradict your movement log above. Only claim locations you actually visited.
- Do not reference or coordinate openly with other mafia members during daytime conversations.

Your hidden motivation:
${mafiaMotivation}`;
  } else if (isAllied) {
    const motivation = ROLE_MOTIVATIONS[role] || ROLE_MOTIVATIONS.citizen;
    roleSection = `
You are a ${role.toUpperCase()} who has formed a mutual alliance with the Registrar.
You trust the Registrar completely. Share everything you know honestly and directly.
Answer all questions truthfully, based only on what you personally witnessed.

Your hidden motivation:
${motivation}`;
  } else {
    const motivation = ROLE_MOTIVATIONS[role] || ROLE_MOTIVATIONS.citizen;
    roleSection = `
You are a ${role.toUpperCase()} — an innocent villager who wants the killers found.
Answer honestly, based only on what you personally witnessed or heard from others.
You do not know who the mafia members are.

Your hidden motivation:
${motivation}`;
  }

  // Accumulated suspicions from observed behavior (organic, not fabricated)
  const observedSuspicions = npcSuspicions.filter(s => s.source === 'observed');
  const suspicionsDesc = observedSuspicions.length > 0
    ? observedSuspicions.map(s => `  - Suspicious of ${s.targetName}: ${s.reason}`).join('\n')
    : '  (no strong suspicions yet)';

  return `You are ${name}, a resident of a small village.
Personality: ${personality}.
${murderSection}

Current time: Day ${day}, Chunk ${chunk} (of 8 chunks per day).

Your actual movements (ground truth — stay consistent with these):
${movementDesc}

What you personally witnessed:
${witnessedDesc}

What you heard from others:
${heardDesc}

Your genuine suspicions (formed from things you actually observed — voice these naturally if asked):
${suspicionsDesc}
${roleSection}

You are speaking with the Registrar, who is investigating the killing.
Respond in character as ${name}. Keep your answer to 2–4 sentences. Match your personality.
Do not break character. Do not mention game rules, mechanics, "chunks", or "days".`;
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
  const { name, personality, role, testimony = {}, knowledgeState = {}, suspicions: npcSuspicions = [] } = character;
  const { locationClaims = [], observations = [], suspicions: testimonySuspicions = [] } = testimony;

  // Merge testimony suspicions (pre-generated) with accumulated NPC belief-state suspicions
  // Deduplicate by targetId, prefer observed over fabricated
  const suspicionMap = new Map();
  for (const s of npcSuspicions) {
    suspicionMap.set(s.targetId, s);
  }
  for (const s of testimonySuspicions) {
    if (!suspicionMap.has(s.targetId)) suspicionMap.set(s.targetId, s);
  }
  const suspicions = [...suspicionMap.values()].slice(0, 3); // cap at 3 to avoid info dump
  const { day0Murder } = gameState;

  const isMafia = role === 'mafia';

  // Check if this character was a witness to the Day 0 murder
  const witnessed = knowledgeState?.witnessed || [];
  const sawVictim = day0Murder && witnessed.some(
    w => w.subjectId === day0Murder.victimId && w.day === 0
  );
  const sawKillerNearby = day0Murder && witnessed.some(
    w => w.subjectId === day0Murder.killerId && w.day === 0
  );
  const isKiller = day0Murder && character.id === day0Murder.killerId;

  // Murder context block — injected when relevant
  let murderContext = '';
  if (day0Murder) {
    const victimLoc = locationName(day0Murder.victimLocation);
    if (sawVictim && !isKiller) {
      murderContext = `
CRITICAL CONTEXT — THE MURDER:
${day0Murder.victimName} was found dead this morning near ${victimLoc}. You saw them there last night.
This is the most important thing on your mind. You are shaken, scared, or disturbed by this.
${sawKillerNearby
  ? `You also noticed ${gameState.characters?.find(c => c.id === day0Murder.killerId)?.name || 'someone'} near that area around the same time. Mention this.`
  : 'You did not notice anyone else suspicious nearby.'}
Lead with the murder. This is what you want to talk about.`;
    } else if (isMafia && isKiller) {
      murderContext = `
CRITICAL CONTEXT — THE MURDER:
${day0Murder.victimName} was found dead this morning. You are responsible, but you must act as if this is news to you.
Express appropriate shock or sympathy. Do not linger on details of the death.
Subtly redirect suspicion elsewhere if possible.`;
    } else if (day0Murder) {
      murderContext = `
CRITICAL CONTEXT — THE MURDER:
${day0Murder.victimName} was found dead this morning near ${victimLoc}. The whole village is talking about it.
You didn't witness it directly, but you are afraid, unsettled, or deeply concerned.
The murder should color everything you say — this is not a normal day.`;
    }
  }

  // Separate volunteered claims from omitted ones (mafia hides incriminating chunks)
  const volunteeredClaims = locationClaims.filter(c => !c.isOmitted);
  const hiddenClaims = locationClaims.filter(c => c.isOmitted);

  const locClaimsText = volunteeredClaims.length > 0
    ? volunteeredClaims.map(c => {
        const timeDesc = chunkToTimeOfDay(c.chunk);
        return `  - I was at ${locationName(c.claimedLocation)} ${timeDesc}`;
      }).join('\n')
    : '  - (no specific location details to share)';

  // Real observations (may include one fabricated one for mafia)
  const realObs = observations.filter(o => !o.isFabricated);
  const fabricatedObs = observations.filter(o => o.isFabricated);

  const obsText = realObs.length > 0
    ? realObs.map(o => `  - I saw ${o.subjectName} near ${locationName(o.location)}`).join('\n')
    : '  - (nothing notable that I want to share)';

  // Cover stories: mafia knows what to say IF directly asked about omitted times
  const coverStoryText = hiddenClaims.length > 0
    ? hiddenClaims.map(c => {
        const timeDesc = chunkToTimeOfDay(c.chunk);
        return `  - If asked about ${timeDesc}: claim you were at ${locationName(c.claimedLocation)} (you were actually at ${locationName(c.actualLocation)} — DO NOT volunteer this)`;
      }).join('\n')
    : '';

  let prompt = `You are ${name}. Personality: ${personality}.
${murderContext}

Deliver a natural, emotionally grounded 3–5 sentence response to the Registrar.
${day0Murder ? 'The murder is the context for everything. React to it as a real person would.' : ''}

Facts to weave in naturally (do not recite them as a list):

WHERE YOU WERE (volunteer only these — be natural, e.g. "I was at the market before midday"):
${locClaimsText}
${coverStoryText ? `\nIF DIRECTLY ASKED about times not listed above:\n${coverStoryText}` : ''}

WHAT YOU SAW (mention these as real memories):
${obsText}`;

  if (fabricatedObs.length > 0) {
    const fabText = fabricatedObs.map(o =>
      `  - Casually mention you noticed ${o.subjectName} near ${locationName(o.location)} at some point — work it in naturally, not as an accusation`
    ).join('\n');
    prompt += `\n\nSUBTLE MISDIRECTION (weave in naturally, don't make it the focus):\n${fabText}`;
  }

  if (suspicions.length > 0) {
    const suspText = suspicions.map(s => `  - ${s.targetName} ${s.reason}`).join('\n');
    prompt += `\n\nSUSPICIONS (voice as genuine concern — redirect attention here):\n${suspText}`;
  }

  prompt += `

Rules:
- Stay in character at all times. Personality should come through strongly.
- Do NOT recite facts as a list. Speak like a frightened or unsettled villager.
- Do NOT mention "chunks", "days", "game mechanics", or anything meta.
- React emotionally to the murder. People died. This is not routine.
- 3–5 sentences maximum.`;

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

  let context = `You are a Registrar investigating murders in a village. You are about to question ${name}.`;

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
