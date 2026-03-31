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
