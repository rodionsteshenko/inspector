# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What We're Building

A single-player social deduction game. The player is an Inspector in a village with hidden
mafia members. Move through a map, talk to AI-driven characters, piece together who's guilty,
get them voted out before you're killed.

Full V1 spec: `V1_SPEC.md`
Full README with gameplay docs: `README.md`

---

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server on port 5181 (also serves /api/* routes)
npm test             # run unit tests once (Vitest)
npm run test:watch   # run tests in watch mode
npm run test:ui      # Vitest UI
npm run test:e2e     # Playwright end-to-end tests
npm run build        # production build
```

To run a single test file: `npx vitest run src/engine/__tests__/roles.test.js`

---

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** API routes embedded in the Vite dev server via a custom plugin in `vite.config.js` (no separate Express server)
- **LLM:** OpenAI API, model `gpt-5.4-mini` — `OPENAI_API_KEY` env var. No Agents SDK; plain `openai.chat.completions.create()`.
- **Art:** OpenAI GPT Image 1 (anime/Ghibli style) — `scripts/generate-images.js`
- **Testing:** Vitest (346 tests), Playwright (e2e). Config in `vite.config.js` under `test:`.
- **Port:** 5181

---

## Architecture

### Code Layout

```
src/
  engine/          # Pure game logic — no React, no I/O, no side effects
    gameState.js   # State shape, PHASES constant, phase transition functions
    roles.js       # ROLES constant, PLAYER_COUNT_CONFIGS, assignRoles*
    characters.js  # NPC_DEFINITIONS, createCharacter, createPlayer
    map.js         # MAP_NODES, MAP_EDGES, adjacency, pathfinding (BFS)
    mapDefinitions.js  # 3 selectable map layouts (small/medium/large)
    movement.js    # movePlayer, generateLocationObservation, logMovementToEvidence
    npcMovement.js # moveNPCs — called every chunk (~30-40% move chance per role)
    poisoning.js   # Mafia coordination mechanic: planMafiaDay, getMafiaKillerNextMove, updateMafiaState
    nightResolution.js  # resolveNight, doctorChooseTarget, mafiaChooseTarget
    winCondition.js     # checkWinCondition, applyVoteResult, formAlliance, WIN_STATES
    evidenceBoard.js    # runContradictionCheck (player obs + NPC cross-reference)
    evidenceExtract.js  # Extract evidence facts from conversation responses
    testimony.js        # generateAllTestimony — pre-generates NPC testimony at day start
    day0.js             # Off-screen murder before player arrives
    saveLoad.js         # LocalStorage save/load
    conversations.js    # Conversation slot tracking helpers
    __tests__/          # Vitest test files, one per engine module

  server/          # API handlers — run inside the Vite dev server process
    api.js         # handleConversation, handleTestimony, handleQuestions (POST handlers)
    prompts.js     # buildCharacterSystemPrompt, buildQuestionsPrompt, buildTestimonyPrompt

  components/      # React UI
    App.jsx        # Root: all game state lives here (useState), all handlers, screen routing
    DayView.jsx    # Main play view: Map + ActionMenu + EvidenceBoard + ConversationModal
    Map.jsx        # SVG map with location images clipped to circles
    ActionMenu.jsx # Context-sensitive actions with character portraits
    ConversationModal.jsx   # LLM conversation UI with character portrait
    EvidenceBoard.jsx       # Fact display (no suspicion scores)
    SetupScreen.jsx         # Game config (map selector, role steppers, saved games)
    CharacterRevealScreen.jsx
    NightScreen.jsx
    DawnScreen.jsx
    VoteScreen.jsx
    GameOverScreen.jsx

  main.jsx         # React entry point

cli/
  mafia-cli.js       # Turn-based CLI harness (JSON I/O, session persistence, replay)
  __tests__/         # CLI integration tests (38 tests)

scripts/
  generate-images.js # Generate location + character art via OpenAI GPT Image API

public/images/
  locations/         # 6 location images (anime/Ghibli style)
  characters/        # 12 character portraits (11 NPCs + player)
```

### Key Patterns

**Immutable pure state.** Every engine function takes state and returns a new state object. No mutation, no classes. `App.jsx` holds all game state with `useState` and passes immutable snapshots down.

**API routes via Vite plugin.** `vite.config.js` registers a `configureServer` middleware that intercepts `/api/conversation`, `/api/questions`, and `/api/testimony`. There is no separate backend process.

**Testimony pre-generation.** At the start of each day (`transitionToDay` and `createGameWithSetup`), `generateAllTestimony` is called to pre-generate NPC monologues via LLM. Conversations during the day use these cached testimonies, not live LLM calls.

**Poisoning mechanic.** Mafia follows a three-phase day plan (stored in `state.mafiaState`):
1. Route independently to a planned `meetingNode`
2. Once both meet at that node, mark `coordinated: true` and assign `killerMafiaId`
3. Killer routes to the target; non-killer disperses away to avoid suspicion

**Chunk system.** A day has configurable chunks (default 8, set via `state.chunksPerDay`). Each player action (move, observe, talk) advances the chunk counter and triggers `moveNPCs`. When chunks are exhausted, `advanceChunk` transitions to `PHASES.NIGHT`.

**Day 0 murder.** `createGameWithSetup` calls `runDay0Murder` to kill an NPC before the player arrives. The murder info is stored in `state.day0Murder` with victim, killer, location, and witnesses. This gives the player an immediate lead to follow.

**Contradiction cross-referencing.** `runContradictionCheck` compares NPC location claims against both the player's direct observations AND other NPCs' testimony observations. When NPC A says they saw NPC B somewhere, and NPC B claims to have been elsewhere, a `testimony_contradiction` is flagged.

---

## Game State Shape

```js
{
  day, chunk, phase,               // current time and phase
  mapConfig,                       // { nodes, edges, adjacencyMap, nodePositions, svgViewBox }
  playerLocation,
  characters: [player, ...npcs],
  evidenceBoard: {
    confirmedRoles, movementLogs, contradictions,
    deathLog, alliances, allyObservations,
    conversationLogs, claimedFacts, npcObservations, proximityFlags,
  },
  nightActions: { mafiaTarget, doctorTarget, inspectorTarget, playerEliminate },
  investigationsUsed, investigationsAvailable,
  conversationsUsed, conversationsAvailable, conversationsPerDay,
  chunksPerDay,
  mafiaIds, mafiaState,            // mafia coordination plan
  masonKnownInnocent,
  lastNightResult,
  mafiaKnowsInspector,
  day0Murder,                      // { victimId, victimName, victimLocation, killerId, witnesses }
  gameOver, winner, winReason,
  setupConfig,                     // { playerCount, conversationsPerDay, chunksPerDay }
}
```

---

## Key Design Rules (don't violate these)

1. **Player can only move to adjacent nodes** — enforce strictly
2. **Investigation result is private** — never shown to other characters
3. **Alliance is a mutual reveal** — both parties exchange roles, neither can tell others; allying with mafia immediately triggers game over
4. **Verified innocent testimony is reliable** — their facts go straight to evidence board
5. **Evidence board shows facts only** — no suspicion scores, no meters, no hints
6. **Conversation choices are dynamic** — generated from context, not hardcoded
7. **Mafia coordinates at a planned meeting node** before hunting target
8. **One investigation per night** (base); Journalist alliance adds +1 conversation slot per day

---

## Testing Philosophy

Logic bugs silently corrupt the social deduction experience. Test every engine module before wiring to UI. The `__tests__/` folder mirrors the engine modules. Pass a seeded `rng` parameter to any function that uses randomness so tests are deterministic.

---

## LLM API Endpoints

All three endpoints accept POST with JSON and require `OPENAI_API_KEY` in the environment.

| Route | Purpose | Key params |
|---|---|---|
| `/api/conversation` | Single character response | `characterId`, `playerMessage`, `conversationHistory[]`, `gameContext` |
| `/api/testimony` | Pre-generate NPC monologue | `characterId`, `gameContext` |
| `/api/questions` | Generate contextual question choices | `characterId`, `gameContext`, `askedQuestions[]` |

Prompts are built in `src/server/prompts.js`. Mafia characters receive their role in the system prompt but are instructed to deflect without lying overtly. Verified innocents answer truthfully from their `movementLog`.

---

## CLI Harness

A turn-based CLI at `cli/mafia-cli.js` for stepping through games one command at a time. All output is JSON. Exit code 0 = success, 1 = error. Sessions are persisted to `cli-sessions/`.

### Commands

```bash
node cli/mafia-cli.js new [playerCount]                    # Start new game
node cli/mafia-cli.js <id> status                          # View current state (no side effects)
node cli/mafia-cli.js <id> move <locationId>               # Move to adjacent node
node cli/mafia-cli.js <id> observe                         # Observe (advances chunk)
node cli/mafia-cli.js <id> talk <charId>                   # Talk to NPC (uses conversation slot)
node cli/mafia-cli.js <id> ally <charId>                   # Propose alliance (reveals identity)
node cli/mafia-cli.js <id> night <inspectId> [eliminateId] # Resolve night phase
node cli/mafia-cli.js <id> dawn                            # Advance to next day
node cli/mafia-cli.js <id> summary                         # Full game summary (no side effects)
node cli/mafia-cli.js <id> history                         # List all checkpoints
node cli/mafia-cli.js <id> replay <step>                   # Restore to previous step (branches from there)
node cli/mafia-cli.js list-sessions                        # List all sessions
```

### Replay / Branching

Every mutating command auto-saves a checkpoint. Use `history` to see all steps, then `replay <step>` to restore the game to that point. Future steps are discarded, so you can take a different path. Files:
- `cli-sessions/<id>.json` — current state
- `cli-sessions/<id>.history.json` — step log
- `cli-sessions/<id>.checkpoints/<step>.json` — state snapshots

### Testing the CLI

```bash
npx vitest run cli/__tests__/mafia-cli.test.js
```

Tests spawn the CLI as a child process, so they exercise the full command → parse → engine → serialize → output pipeline.
