# The Inspector

A single-player social deduction game. You are an Inspector who has arrived in a village where someone has been murdered. Hidden mafia members walk among the villagers. Move through the map, talk to AI-driven characters, piece together who's guilty, and eliminate them before they kill you.

**Stack:** React + Vite + Tailwind CSS + OpenAI API (`gpt-5.4-mini`)
**Port:** 5181
**Tests:** 346 unit tests (Vitest) + E2E (Playwright)

```bash
npm install
npm run dev          # http://localhost:5181
```

Requires `OPENAI_API_KEY` in your environment for AI conversations.

---

## How to Play

### Setup Screen
Choose your game parameters:
- **Map layout:** Hamlet (4 locations), Village (5), or Town (6) — each with SVG preview
- **Player count:** 6-12 (adjusts NPC count)
- **Conversations per day:** 1-6
- **Time chunks per day:** 4-12
- **Role composition:** Adjust mafia, doctor, journalist, mason with +/- steppers; citizens auto-fill remainder
- **Load game:** Resume a previously saved game from the setup screen

### Game Loop

```
Setup → Character Reveal → Day 0 Murder → [Day → Night → Dawn] × N → Game Over
```

**Day 0 Murder:** Someone is already dead when you arrive. Witnesses near the crime scene may have seen something — find them.

**Day phase** (configurable chunks per day):
- **Move** to adjacent locations on the map
- **Observe** who's at your current location (logged to evidence board)
- **Talk** to NPCs (uses a conversation slot). They share testimony: where they claim to have been, who they saw, and who they suspect
- **Ally** with an NPC (reveals your identity as Inspector — if they're mafia, you lose instantly)
- **Save** your game at any time

**Night phase:**
- **Investigate** one person — learn their true role (private, added to evidence board)
- **Eliminate** one person — they die, role revealed at dawn
- Both are optional and independent

**Dawn phase:**
- See who the mafia killed overnight (or if the doctor saved someone)
- New day begins with fresh testimony and conversation slots

### Win / Lose Conditions

| Outcome | Condition |
|---------|-----------|
| **Player wins** | All mafia eliminated |
| **Mafia wins** | Player killed at night |
| **Mafia wins** | Mafia reaches parity with innocents |
| **Mafia wins** | Player allies with a mafia member |
| **Mafia wins** | Time runs out (day limit exceeded) |

---

## Deduction Mechanics

### Testimony System
At each day start, every NPC gets a pre-generated `testimony` — what they will claim when you talk to them. The LLM voices these facts naturally; it doesn't invent them.

- **Innocent NPCs:** All location claims match their actual movement log. Observations are truthful.
- **Mafia NPCs:** Deception is behavioral, not blanket fabrication:
  - **Omission over lies** — they don't volunteer the chunks where they were coordinating with their partner or approaching the victim. Silence is harder to catch than a false claim.
  - **Cover stories on demand** — if directly asked about a suspicious time slot, they claim a plausible public location. The lie is lazy (always somewhere innocuous) which is a tell.
  - **Fabricated sighting** — they casually mention seeing an innocent at a vaguely suspicious location. A false trail, not an accusation.
  - **Deflection** — they point suspicion at a specific innocent with a behavioral reason ("seemed nervous," "left without explanation").
  - **Partner suppression** — they never mention seeing their mafia partner, even if they were together. An NPC who never mentions another specific person may be hiding something.

### Contradiction Detection
When you talk to multiple NPCs, the game cross-references:
1. **Player observations vs NPC claims** — You saw Elena at the docks, but she claims she was at the library? Flagged.
2. **NPC testimony vs NPC claims** — Viktor says he saw Elena at the docks, but Elena claims she was at the library? Also flagged.

Contradictions appear automatically on the evidence board.

### Evidence Board Sources
Every entry is tagged by source:
- **You observed** — ground truth from your own observations
- **[Ally] observed** — real-time stream from allied NPCs
- **[Name] claimed** — from conversation (may be a lie)
- **Contradiction** — auto-flagged mismatch between claim and observation
- **Confirmed** — investigation result or alliance reveal
- **Proximity** — was near a victim on the day of a kill

### Alliance Mechanic
Proposing an alliance is a one-way door:
- **Innocent ally:** Their entire witness history dumps to your evidence board. They report to you in real-time. Role ability unlocks (journalist = +1 conversation/day).
- **Mafia ally:** Game over. You revealed yourself.

---

## Roles

| Role | Team | Ability |
|------|------|---------|
| Inspector (you) | Innocents | Investigate one person per night to learn their role |
| Citizen | Innocents | No special ability |
| Doctor | Innocents | Protects one person per night from mafia kill |
| Journalist | Innocents | Alliance gives +1 conversation slot per day |
| Mason | Innocents | Knows one confirmed innocent NPC |
| Mafia (2+) | Mafia | Coordinate to kill one person per night; lie in testimony |

---

## Mafia Behavior (Poisoning Mechanic)

Mafia members follow a three-phase day plan, computed at dawn:
1. **Route** independently to a planned meeting node
2. **Coordinate** once both arrive — assign a killer
3. **Hunt** — killer routes toward the target; the other disperses away to avoid suspicion

Planning evaluates all (target, meeting node) combinations and picks the best feasible one (30% weight toward targeting the player). If they can't coordinate in time, no kill happens that night.

---

## Project Structure

```
src/
  engine/              # Pure game logic (no React, no I/O, no side effects)
    gameState.js       # State shape, phase transitions, createGameWithSetup
    roles.js           # Role definitions, PLAYER_COUNT_CONFIGS, assignRoles*
    characters.js      # 11 NPC definitions + player character
    map.js             # Adjacency, pathfinding (BFS), legacy 8-node constants
    mapDefinitions.js  # 3 selectable map layouts (small/medium/large)
    movement.js        # Player movement, observations, evidence logging
    npcMovement.js     # NPC AI movement (role-based, ~30-40% move chance per chunk)
    poisoning.js       # Mafia coordination: planMafiaDay, getMafiaKillerNextMove
    nightResolution.js # resolveNight, doctorChooseTarget, mafiaChooseTarget
    winCondition.js    # checkWinCondition, formAlliance, applyVoteResult
    evidenceBoard.js   # Contradiction detection (player obs + NPC cross-reference)
    evidenceExtract.js # Extract evidence facts from LLM conversation responses
    testimony.js       # Pre-generate NPC testimony at day start
    day0.js            # Off-screen murder before player arrives
    saveLoad.js        # LocalStorage save/load (max 20 saves)
    conversations.js   # Conversation slot tracking helpers
    __tests__/         # Vitest tests (one per module)

  server/              # API handlers (run inside Vite dev server via plugin)
    api.js             # POST: /api/conversation, /api/testimony, /api/questions
    prompts.js         # LLM system prompts per character role

  components/          # React UI
    App.jsx            # Root: all game state (useState), all handlers, screen routing
    DayView.jsx        # Main play view: Map + ActionMenu + EvidenceBoard
    Map.jsx            # SVG map with location images clipped to circles
    ActionMenu.jsx     # Context-sensitive actions with character portraits
    ConversationModal.jsx  # LLM conversation UI with character portrait
    EvidenceBoard.jsx  # Right panel: facts, contradictions, death log
    SetupScreen.jsx    # Game config (map selector, role steppers, saved games)
    CharacterRevealScreen.jsx  # Opening with portraits and day 0 murder reveal
    NightScreen.jsx    # Night action selection
    DawnScreen.jsx     # Night results
    VoteScreen.jsx     # (unused — kept for reference)
    GameOverScreen.jsx # Win/lose with full role reveal

cli/
  mafia-cli.js         # Turn-based CLI harness (JSON I/O, session persistence)
  __tests__/           # CLI integration tests (38 tests)

scripts/
  generate-images.js   # Generate location + character art via OpenAI GPT Image API

public/images/
  locations/           # 6 location images (anime/Ghibli style)
  characters/          # 12 character portraits (11 NPCs + player)

cli-sessions/          # CLI session state, history, and checkpoints
```

---

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Dev server (port 5181, also serves /api/* routes)
npm run build            # Production build
npm test                 # Run all 346 tests
npm run test:watch       # Watch mode
npm run test:ui          # Vitest UI
npm run test:e2e         # Playwright e2e tests
```

Run a single test: `npx vitest run src/engine/__tests__/roles.test.js`

---

## CLI Harness

A turn-based CLI for stepping through games without the browser. All output is JSON. Exit code 0 = success, 1 = error.

```bash
node cli/mafia-cli.js new [playerCount]                    # Start new game
node cli/mafia-cli.js <id> status                          # View current state
node cli/mafia-cli.js <id> move <locationId>               # Move to adjacent node
node cli/mafia-cli.js <id> observe                         # Observe current location
node cli/mafia-cli.js <id> talk <charId>                   # Talk to NPC (logs to evidence)
node cli/mafia-cli.js <id> ally <charId>                   # Propose alliance
node cli/mafia-cli.js <id> night <inspectId> [eliminateId] # Resolve night
node cli/mafia-cli.js <id> dawn                            # Advance to next day
node cli/mafia-cli.js <id> summary                         # Full game summary
node cli/mafia-cli.js <id> history                         # List all checkpoints
node cli/mafia-cli.js <id> replay <step>                   # Restore to previous step
node cli/mafia-cli.js list-sessions                        # List all sessions
```

### Replay / Branching
Every mutating command auto-saves a checkpoint. Use `history` to see all steps, then `replay <step>` to restore the game to that point. Future steps are discarded, so you can branch and take a different path.

Files:
- `cli-sessions/<id>.json` — current state
- `cli-sessions/<id>.history.json` — step log
- `cli-sessions/<id>.checkpoints/<step>.json` — state snapshots

```bash
npx vitest run cli/__tests__/mafia-cli.test.js   # Run CLI tests (38 tests)
```

---

## Image Generation

Generate game art with OpenAI GPT Image API (requires `OPENAI_API_KEY`):

```bash
node scripts/generate-images.js                   # All 18 images
node scripts/generate-images.js locations          # 6 locations only
node scripts/generate-images.js characters         # 12 characters only
node scripts/generate-images.js locations church   # Single image
```

Style: Anime/Studio Ghibli inspired — warm colors, cel-shaded, European fantasy village with a mysterious edge. Style prompts are defined in `scripts/generate-images.js`.

---

## Key Architecture Patterns

**Immutable pure state.** Every engine function takes state and returns a new state object. No mutation, no classes. `App.jsx` holds all game state with `useState`.

**Map config in state.** `state.mapConfig` contains nodes, edges, adjacencyMap, nodePositions, and svgViewBox. All map functions accept optional params defaulting to legacy 8-node constants for backward compatibility.

**API routes via Vite plugin.** `vite.config.js` registers a `configureServer` middleware for `/api/*`. No separate backend process.

**Testimony pre-generation.** At each day start, `generateAllTestimony` creates all NPC testimony. Conversations use these cached testimonies, not live LLM calls.

**Chunk system.** Each player action (move, observe, talk) advances the chunk counter and triggers `moveNPCs`. When chunks are exhausted, the game transitions to night.

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

## Known Issues / Areas for Improvement

1. **Testimony is thin** — NPCs only claim 1-2 locations per day. More claims = more chances for contradictions to surface through cross-referencing.
2. **Timing ambiguity** — NPCs move within a chunk, so observations and claims at the same day+chunk can create false contradictions for innocents.
3. **Alliance strategy is unclear** — No breadcrumbs for who's safe to ally with (beyond the Mason hint). Players mostly rely on investigation.
4. **Late-game days feel empty** — Once conversations are used, remaining chunks are just observing to reach night.
5. **NPC observations are sparse** — NPCs don't generate enough observations of each other, limiting the cross-referencing that drives deduction.
