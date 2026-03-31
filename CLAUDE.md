# CLAUDE.md — Mafia Game

## What We're Building

A single-player social deduction game. The player is an Inspector in a village with hidden
mafia members. Move through a map, talk to AI-driven characters, piece together who's guilty,
get them voted out before you're killed.

Full design: `DESIGN.md`
Full V1 spec: `V1_SPEC.md`

Read both before starting. They are the source of truth.

---

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js / Express (or Vite API routes if simpler)
- **LLM:** OpenAI API, model `gpt-5.4-mini` — use the `OPENAI_API_KEY` env var. Direct REST calls or openai npm package, no Agents SDK needed.
- **Game state:** Local JSON files or SQLite (keep it simple)
- **Map:** Interactive SVG or CSS-based node graph
- **Port:** 5181 (avoid conflicts with other projects on 5173, 5175, 5180)

---

## Testing Philosophy — CRITICAL

This is a conversation-driven game. Logic bugs will silently corrupt the experience.
Test heavily at every layer. Do not skip tests to ship faster.

### Unit Tests
- Game state transitions (day → night → dawn)
- Movement validation (can only move to adjacent nodes)
- Role assignment (correct distribution, no duplicates)
- Investigation result logic (returns correct role)
- Alliance mechanic (mutual reveal, ability unlocking)
- Win/lose condition checks
- Evidence board population logic

### Integration Tests
- Full day cycle: move → converse → observe → night → dawn
- Vote resolution: correct character eliminated, role revealed
- Death resolution: mafia kill + doctor save interaction
- Alliance flow: reveal → role exchange → ability granted
- Evidence board: contradiction detection across movement logs

### UI Tests (Playwright or similar)
- Map renders correctly, all nodes clickable
- Action menu shows correct options based on location/occupants
- Conversation interface opens, choices render, response displays
- Evidence board updates after each conversation/observation
- Night screen shows correct available investigation targets
- Dawn screen shows correct death/investigation results
- Win/lose screens trigger correctly

### LLM/Conversation Tests
- Character responses stay in character (personality consistent)
- Mafia characters don't accidentally reveal their role
- Verified innocents don't contradict known facts
- Conversation choices are contextually relevant
- Characters reference things they actually witnessed (not hallucinated)

---

## Build Order

Build incrementally. Test each layer before moving to the next.
Never have untested game logic powering UI.

### Phase 1 — Game Engine (no UI)
1. Role assignment system
2. Map graph (nodes + edges + adjacency)
3. Character movement engine
4. Conversation log + observation log
5. Night resolution (kill, protect, investigate)
6. Evidence board logic (contradiction detection)
7. Win/lose condition checker

**Test everything in Phase 1 before writing any UI.**

### Phase 2 — Basic UI Shell
1. Map view (static, no interactions yet)
2. Action menu (hardcoded choices to test rendering)
3. Evidence board display (read-only)
4. Day/night/dawn screen transitions

**Test all screens render correctly before wiring game logic.**

### Phase 3 — Wire UI to Engine
1. Map clicks trigger movement
2. Action menu options come from game state
3. Conversation opens and closes correctly
4. Night screen reads from game state
5. Dawn screen shows real results

**Integration tests here. Full day cycle should work end to end.**

### Phase 4 — LLM Conversations
1. Character prompt templates (personality + role + knowledge state)
2. Dynamic question generation based on context
3. Response parsing and evidence extraction
4. Conversation logging to evidence board

**Test LLM responses extensively. Characters must stay consistent.**

### Phase 5 — Polish
1. Map styling, character portraits/icons
2. Evidence board UX improvements
3. Conversation UI feel
4. Win/lose screens
5. New game / role randomization

---

## Key Design Rules (don't violate these)

1. **Player can only move to adjacent nodes** — enforce this strictly
2. **Investigation result is private** — never shown to other characters
3. **Alliance is a mutual reveal** — both parties exchange roles, neither can tell others
4. **Verified innocent testimony is reliable** — their facts go straight to evidence board
5. **Evidence board shows facts only** — no suspicion scores, no meters, no hints
6. **Conversation choices are dynamic** — generated from context, not hardcoded
7. **Mafia coordinates at night** — they don't interact suspiciously during the day
8. **One investigation per night** (base) — Journalist alliance adds +1 conversation slot per day, not investigations

---

## Character Data Structure

```json
{
  "id": "brad_barber",
  "name": "Brad the Barber",
  "personality": "chatty, knows everyone's business, talks too much",
  "role": "citizen",
  "location": "tavern",
  "movementLog": [
    { "chunk": 1, "location": "town_square" },
    { "chunk": 2, "location": "tavern" }
  ],
  "conversationLog": [],
  "knowledgeState": {
    "witnessed": [],
    "heardFrom": []
  },
  "suspicions": [],
  "alive": true,
  "verifiedByInspector": false,
  "alliedWithInspector": false
}
```

## Map Data Structure

```json
{
  "nodes": [
    { "id": "town_square", "name": "Town Square", "capacity": 6, "visibility": "public" },
    { "id": "tavern", "name": "Tavern", "capacity": 4, "visibility": "public" },
    { "id": "cellar", "name": "Cellar", "capacity": 2, "visibility": "private" }
  ],
  "edges": [
    ["town_square", "church"],
    ["town_square", "docks"],
    ["town_square", "market"],
    ["town_square", "tavern"],
    ["market", "library"],
    ["tavern", "alley"],
    ["alley", "cellar"]
  ]
}
```

## Game State Structure

```json
{
  "day": 2,
  "chunk": 4,
  "phase": "day",
  "playerLocation": "tavern",
  "characters": [],
  "evidenceBoard": {
    "confirmedRoles": {},
    "movementLogs": [],
    "contradictions": [],
    "deathLog": [],
    "alliances": []
  },
  "investigationsUsed": 0,
  "investigationsAvailable": 1,
  "conversationsUsed": 0,
  "conversationsAvailable": 3
}
```

---

## LLM Conversation Prompting

Use OpenAI API (`gpt-5.4-mini`) for all character conversations. Install `openai` npm package. Use `OPENAI_API_KEY` env var. Keep it simple — no Agents SDK, just `openai.chat.completions.create()`. Each call is: system prompt (character context) + conversation history + player message → one response.

Each character prompt includes:
- Their name and personality
- Their role (only revealed if allied with player)
- What they personally witnessed (their movementLog observations)
- What they've heard from others
- Current day/chunk context
- The player's question

Mafia characters: respond naturally, no suspicious behavior, deflect without lying overtly.
Verified innocents: answer truthfully based only on what they witnessed.

---

## Running the Project

```bash
# Install
npm install

# Dev
npm run dev  # runs on port 5181

# Test
npm test           # unit tests
npm run test:e2e   # playwright UI tests

# Build
npm run build
```

---

## What Good Looks Like

A player should be able to:
1. Start a new game, see the map, know where they are
2. Click to move, see the action menu update
3. Have a conversation that feels natural and contextual
4. Wake up after night to find out what happened
5. Use the evidence board to catch a contradiction
6. Win or lose based on their deductions

If any of those steps feel broken or confusing, fix it before moving on.
