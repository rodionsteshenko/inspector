// Server-side API route handlers for LLM conversations
// Registered in vite.config.js via configureServer plugin

import OpenAI from 'openai';
import { buildCharacterSystemPrompt, buildQuestionsPrompt, buildTestimonyPrompt } from './prompts.js';

let _openai = null;

function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/** Read and JSON-parse the full request body. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * POST /api/conversation
 * Body: { characterId, playerMessage, conversationHistory?, gameContext: { character, gameState } }
 * Returns: { response: string }
 */
export async function handleConversation(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const { characterId, playerMessage, conversationHistory = [], gameContext } = body;

    if (!characterId || !playerMessage || !gameContext?.character || !gameContext?.gameState) {
      return sendJson(res, 400, { error: 'Missing required fields: characterId, playerMessage, gameContext.{character,gameState}' });
    }

    const { character, gameState } = gameContext;
    const systemPrompt = buildCharacterSystemPrompt(character, gameState);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: playerMessage },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.4-mini',
      messages,
      max_completion_tokens: 200,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '';
    return sendJson(res, 200, { response });

  } catch (err) {
    console.error('[/api/conversation]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * POST /api/testimony
 * Body: { characterId, gameContext: { character, gameState } }
 * Returns: { monologue: string }
 */
export async function handleTestimony(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const { characterId, gameContext } = body;

    if (!characterId || !gameContext?.character || !gameContext?.gameState) {
      return sendJson(res, 400, { error: 'Missing required fields: characterId, gameContext.{character,gameState}' });
    }

    const { character, gameState } = gameContext;
    const prompt = buildTestimonyPrompt(character, gameState);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 200,
      temperature: 0.8,
    });

    const monologue = completion.choices[0]?.message?.content?.trim() || '';
    return sendJson(res, 200, { monologue });

  } catch (err) {
    console.error('[/api/testimony]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * POST /api/questions
 * Body: { characterId, gameContext: { character, gameState }, askedQuestions? }
 * Returns: { questions: string[] }  — 3–4 contextual question strings
 */
export async function handleQuestions(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const { characterId, gameContext, askedQuestions = [] } = body;

    if (!characterId || !gameContext?.character || !gameContext?.gameState) {
      return sendJson(res, 400, { error: 'Missing required fields: characterId, gameContext.{character,gameState}' });
    }

    const { character, gameState } = gameContext;
    const prompt = buildQuestionsPrompt(character, gameState, askedQuestions);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 200,
      temperature: 0.9,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const questions = raw
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 5 && q.length < 200)
      .slice(0, 4);

    if (questions.length === 0) {
      return sendJson(res, 500, { error: 'No questions generated' });
    }

    return sendJson(res, 200, { questions });

  } catch (err) {
    console.error('[/api/questions]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * POST /api/dossier-summary
 * Body: { character, gameState }
 * Returns: { summary: string }
 */
export async function handleDossierSummary(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const { character, gameState } = body;

    if (!character || !gameState) {
      return sendJson(res, 400, { error: 'Missing character or gameState' });
    }

    const { evidenceBoard, characters, chunksPerDay = 8 } = gameState;
    const { confirmedRoles = {}, movementLogs = [], contradictions = [],
            conversationLogs = [], claimedFacts = [], proximityFlags = [],
            allyObservations = [], deathLog = [] } = evidenceBoard || {};

    const charId = character.id;
    const getCharName = (id) => characters?.find(c => c.id === id)?.name || id;

    function chunkToTime(chunk) {
      const ratio = chunk / chunksPerDay;
      if (ratio <= 0.25) return 'early morning';
      if (ratio <= 0.5)  return 'morning';
      if (ratio <= 0.625) return 'midday';
      if (ratio <= 0.75) return 'afternoon';
      if (ratio <= 0.875) return 'evening';
      return 'dusk';
    }

    // Build a structured evidence summary to feed the LLM
    const lines = [];
    lines.push(`Character: ${character.name}`);
    lines.push(`Status: ${character.alive ? 'alive' : 'dead'}`);
    if (confirmedRoles[charId]) lines.push(`Confirmed role: ${confirmedRoles[charId]}`);

    const myMovements = movementLogs.filter(l => l.characterId === charId);
    if (myMovements.length > 0) {
      lines.push('\nDirect observations (you saw them):');
      myMovements.forEach(l => lines.push(`  - ${l.location} on Day ${l.day}, ${chunkToTime(l.chunk)}`));
    }

    const theirClaims = claimedFacts.filter(f => f.type === 'location_claim' && f.characterId === charId);
    if (theirClaims.length > 0) {
      lines.push('\nWhat they claimed about their whereabouts:');
      theirClaims.forEach(f => lines.push(`  - Said they were at ${f.location} on Day ${f.day}, ${chunkToTime(f.chunk)}${f.verified ? ' [verified innocent]' : ''}`));
    }

    const saidAboutThem = claimedFacts.filter(f => f.type === 'observation_claim' && f.subjectId === charId);
    if (saidAboutThem.length > 0) {
      lines.push('\nWhat others said about them:');
      saidAboutThem.forEach(f => lines.push(`  - ${getCharName(f.observerId)} says they were at ${f.location} on Day ${f.day}, ${chunkToTime(f.chunk)}${f.verified ? ' [from verified innocent]' : ''}`));
    }

    const allyObs = allyObservations.filter(o => o.subjectId === charId);
    if (allyObs.length > 0) {
      lines.push('\nAlly intelligence:');
      allyObs.forEach(o => lines.push(`  - ${o.allyName} saw them at ${o.location} on Day ${o.day}, ${chunkToTime(o.chunk)}`));
    }

    const theirContradictions = contradictions.filter(c => c.characterId === charId);
    if (theirContradictions.length > 0) {
      lines.push('\nContradictions flagged:');
      theirContradictions.forEach(c => lines.push(`  - ${c.description}`));
    }

    const proximity = proximityFlags.filter(f => f.characterId === charId);
    if (proximity.length > 0) {
      lines.push('\nProximity to victims:');
      proximity.forEach(f => lines.push(`  - Was near ${getCharName(f.victimId)} on Day ${f.day}`));
    }

    const convos = conversationLogs.filter(l => l.characterId === charId);
    if (convos.length > 0) {
      lines.push('\nConversations with Rodion the Registrar:');
      convos.forEach(l => {
        if (l.question) lines.push(`  Q: "${l.question}"`);
        lines.push(`  A: "${l.response?.slice(0, 200)}${l.response?.length > 200 ? '...' : ''}"`);
      });
    }

    const prompt = `You are assisting Rodion the Registrar, who is investigating murders in a small village.

Here is all the evidence gathered so far about ${character.name}:

${lines.join('\n')}

Analyze this evidence and write a concise investigator's note (3–5 sentences) in the style of a detective's case file. Address:
1. What is known or suspected about where this person has been
2. Whether their account is consistent or contradictory
3. How suspicious they appear and why
4. What Rodion should do next regarding this person (talk to them again, watch them, confront them, rule them out, etc.)

Be direct and analytical. Write in second person ("You observed...", "Their account..."). Do not invent facts not in the evidence.`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 300,
      temperature: 0.7,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || 'Unable to generate summary.';
    return sendJson(res, 200, { summary });

  } catch (err) {
    console.error('[/api/dossier-summary]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}
