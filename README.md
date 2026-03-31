# The Inspector

A single-player social deduction game. You are the Inspector in a village with hidden mafia members. Move through a map, talk to AI-driven characters, piece together who's guilty, and eliminate them before they kill you.

**Running:** http://192.168.1.252:5181  
**Stack:** React + Vite + Tailwind + Node.js/Express + OpenAI API  
**Port:** 5181  
**Tests:** 308 unit tests (Vitest) + E2E (Playwright)

```bash
npm run dev      # dev server (binds 0.0.0.0 for LAN access)
npm test         # unit tests
npm run test:e2e # playwright E2E
npm run build    # production build
```

Requires `OPENAI_API_KEY` in environment for LLM conversations.

---

## Codebase

```
src/
  engine/           # All game logic (pure JS, no UI dependencies)
    gameState.js    # State machine, phase transitions, chunk/day management
    characters.js   # NPC definitions, character creation
    roles.js        # Role assignment, role pool configs per player count
    map.js          # Graph nodes, edges, adjacency, pathfinding
    movement.js     # Move validation, moveCharacter, player observation
    npcMovement.js  # NPC AI movement (role-driven pathfinding per chunk)
    poisoning.js    # Mafia day-planning engine (meet → coordinate → hunt)
    nightResolution.js  # Kill, protect, investigate, player eliminate resolution
    winCondition.js # Win/lose checks, formAlliance, vote calculation
    evidenceBoard.js    # Contradiction detection, movement log helpers
    testimony.js    # Pre-configure character claims at game start
    evidenceExtract.js  # Extract facts from LLM responses to evidence board
    conversations.js    # Static fallback responses (pre-LLM)
    __tests__/      # Vitest unit tests for every engine module

  components/       # React UI
    SetupScreen.jsx         # Game config (player count, conversations/day)
    CharacterRevealScreen.jsx
    DayView.jsx             # Main gameplay: map + action menu + evidence board
    Map.jsx                 # SVG map with clickable nodes
    ActionMenu.jsx          # Move / Observe / Talk / Ally buttons
    EvidenceBoard.jsx       # Right panel: all evidence, tagged by source
    ConversationModal.jsx   # Monologue display + propose alliance
    NightScreen.jsx         # Investigate + Eliminate decisions
    DawnScreen.jsx          # Night results reveal
    VoteScreen.jsx          # (unused — kept for reference)
    GameOverScreen.jsx      # Win/lose with full role reveal

  server/
    api.js          # Express API routes: /api/testimony, /api/conversation, /api/questions
    prompts.js      # LLM prompt builders

  App.jsx           # Top-level routing and all game handler callbacks
```

---

## Game Loop

```
Setup → Character Reveal → [Day → Night → Dawn] × N → Game Over
```

**Day phase** (6 chunks):
- Move to adjacent locations (one hop per chunk)
- Observe quietly (logs who's at your location to evidence board)
- Talk to someone (uses a conversation slot, triggers monologue + evidence extraction)
- Propose alliance (from conversation modal — one-way door, high risk)

**Night phase:**
- Investigate one person → learn their exact role (private, evidence board)
- Eliminate one person → they die, role revealed at dawn
- Both optional and independent

**Dawn phase:**
- See who the mafia killed
- See if doctor saved anyone
- See your investigation result
- See your eliminate result
- New day begins

---

## Win / Lose Conditions

**Player wins:** All mafia eliminated (via player eliminate action)

**Mafia wins:**
- Mafia count ≥ innocent count (parity — they can outvote)
- Player is killed by mafia at night
- Player allies with a mafia member (instant game over — identity revealed)

No vote screen. No day limit. The game ends when one side wins.

---

## Key Design Decisions

### Testimony System
At game start (and each new day), every character gets a pre-configured `testimony` object — what they will claim when you talk to them. The LLM voices these facts naturally; it doesn't invent them.

- **Innocent characters:** All location claims match their actual movement log. Observations are true based on what they witnessed.
- **Mafia characters:** 1-2 location claims are lies (covering the chunks when they met their partner or hunted their target). One deflection suspicion pointing at a random innocent.

Contradictions auto-flag on the evidence board when testimony claims don't match observed movement logs.

### Mafia Planning Engine (`poisoning.js`)
At dawn each day, mafia run a full planning pass:
1. Try every (target, meeting node) combination on the map
2. For each: calculate `max(distA, distB) + 1` = earliest chunk both can meet; check if enough chunks remain to reach target from there
3. Pick best feasible plan (30% weight toward targeting the player)
4. If no feasible plan → no kill tonight

During the day:
- Chunks 1→meetChunk: both mafia route toward meeting node
- At meeting node: coordination locked, killer assigned
- After meeting: killer routes to victim; other mafia actively disperses (maximizes distance from both killer and target)

The dispersal creates a real evidence pattern: seen together once, then conspicuously apart.

### Alliance Mechanic
Proposing an alliance is a one-way door:
- **Innocent ally:** Their entire witnessed history dumps to your evidence board instantly (tagged with their name). They report to you in real-time for the rest of the game. Their role ability unlocks immediately.
- **Mafia ally:** Game over. You revealed yourself. The village is lost.

### Evidence Board Sources
Every entry is tagged by source:
- 🔵 You observed (ground truth)
- 🟢 [Ally name] observed (ally stream, real-time)
- 🟡 [Name] claimed (from conversation — may be a lie)
- 🔴 Contradiction (auto-flagged mismatch between claim and observation)
- ⚪ Confirmed (investigation result or alliance reveal)
- 💀 Proximity (was near a victim on the day of a kill)

---

## Known Design Issues / Next Work

### Map needs a redesign
Current map: 8 locations in a chain-like structure with Town Square as single hub. This creates dead ends (Library, Cellar) and low encounter density — too many empty rooms.

**Proposed fix:** 6 locations in a loose grid with multiple routes, no single bottleneck, max 2-3 hops between any two nodes. Example:
```
Church --- Docks
  |           |
Town Square--Market
  |           |
Tavern --- Library
```

This should be configurable per player count (fewer locations = denser encounters).

### Chunk count
Currently 8 chunks per day. 6 feels better — enough time for 3 conversations + movement without too much idle wandering.

### Conversation slots
Currently configurable (2/3/4) in setup. Could simplify to fixed 3 and remove the knob — fewer setup options is better UX.

### Day count selector
Removed from design — win condition is purely parity-based, no day limit needed.

### NPC AI depth
NPC movement is role-driven but characters don't respond dynamically to what's happening (they don't "react" to deaths, don't change behavior if they suspect the inspector). Future work.

### No mobile layout
Map SVG works on desktop. Phone requires responsive layout work.

---

## Role Reference

| Role | Team | Ability |
|------|------|---------|
| Inspector | Innocents | Investigate one person per night. Ally to share identity. |
| Mafia | Mafia | Coordinate daily, kill one person per night. Know each other. |
| Doctor | Innocents | Protects one person from the mafia kill each night. |
| Mason | Innocents | Knows one confirmed innocent at game start. |
| Journalist | Innocents | Ally grants +1 conversation slot per day. |
| Citizen | Innocents | No ability. Pure social deduction. |

---

## Ally Abilities (when you ally with them)

| Role | What you get |
|------|-------------|
| Doctor | See who she protects each night (shown at dawn) |
| Journalist | +1 conversation slot for rest of game |
| Mason | Their confirmed innocent immediately added to your evidence board |
| Citizen | Their witness stream (still valuable if well-positioned) |

---

## File: DESIGN.md
Full design rationale and decisions.

## File: PHASE5_SPEC.md  
Original Phase 5 feature spec (setup screen, poisoning mechanic, playable loop).

## File: OVERHAUL_SPEC.md
Spec for the testimony/monologue/night-eliminate overhaul (implemented 2026-03-30).
