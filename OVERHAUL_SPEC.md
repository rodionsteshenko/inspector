# Inspector Overhaul Spec

Read ALL existing source files before making any changes. Understand the full codebase first.
Run `npm test` at the end and fix any failures before finishing.

---

## 1. TESTIMONY SYSTEM

### New file: src/engine/testimony.js

Each character gets a `testimony` object generated at game start, containing what they WILL claim when talked to. The LLM voices it — it does not invent it.

```js
// testimony structure per character
{
  locationClaims: [
    { day: 1, chunk: 3, claimedLocation: "church", actualLocation: "alley", isLie: true },
    { day: 1, chunk: 6, claimedLocation: "market", actualLocation: "market", isLie: false },
  ],
  observations: [
    { subjectId: "brad_barber", subjectName: "Brad the Barber", location: "tavern", day: 1, chunk: 4, isTrue: true },
  ],
  suspicions: [
    { targetId: "old_tomas", targetName: "Old Tomas", reason: "seemed nervous near the docks" }
  ]
}
```

Rules:
- Innocent characters: locationClaims always true (match movementLog). Observations true from knowledgeState.witnessed. No lies.
- Mafia characters: 1-2 locationClaims are lies (pick chunks where they were near their partner or target). Include 1 deflection suspicion pointing at a random innocent.
- Call generateAllTestimony(state, day) in createGameWithSetup (day 1) and in transitionToDay (each new day).
- Store testimony on each character: character.testimony

Export: `generateTestimony(character, allCharacters, day, rng)` and `generateAllTestimony(state, day, rng)`

---

## 2. CONVERSATIONS — Monologue only, no question drilling

### src/server/prompts.js — add buildTestimonyPrompt(character, gameState)

Instructs LLM to deliver a natural monologue containing the pre-configured testimony facts. 3-5 sentences. Character voices the facts naturally without listing them. No question/answer format.

Pass in the testimony facts explicitly:
```
You are [name]. Personality: [personality].

Deliver a natural 3-5 sentence statement to the Inspector containing these facts:
LOCATION CLAIMS: (list them as "I was at X around midmorning" etc)
OBSERVATIONS: (list them as "I saw [name] near [place]" etc)  
SUSPICIONS: (if any, weave in naturally)

Stay in character. Do not mention "chunks", "days", or game mechanics.
```

### src/server/api.js — add POST /api/testimony endpoint

Body: `{ characterId, gameContext: { character, gameState } }`
Returns: `{ monologue: string }`
Uses buildTestimonyPrompt. Keep old endpoints for backward compat.

### src/components/ConversationModal.jsx — rewrite

New behavior:
1. Opens, shows character name + personality
2. Loading state: "listening..."
3. Fetches from /api/testimony on mount
4. Renders monologue as a single paragraph
5. Two buttons below: "Propose Alliance" (purple, warning text "⚠ reveals your identity") and "Leave"
6. No question list. No follow-up. One monologue, done.
7. "Propose Alliance" calls onAlliance(targetId) then closes modal
8. Auto-calls onLogConversation with extracted facts after monologue loads

---

## 3. REMOVE VOTE SCREEN

### src/engine/gameState.js
- In advanceChunk: when nextChunk > CHUNKS_PER_DAY, set phase to PHASES.NIGHT (not PHASES.VOTE)
- Keep PHASES.VOTE defined but unused

### src/components/App.jsx
- Remove handleVote, handleSkipVote
- handleCallVote: call transitionToNight directly, set mafia/doctor targets, set phase NIGHT
- Remove VoteScreen routing

---

## 4. NIGHT SCREEN — Add player eliminate

### src/engine/gameState.js
- Add "playerEliminate" to valid action types in setNightAction
- Add playerEliminate: null to nightActions object in both createInitialGameState and createGameWithSetup

### src/engine/nightResolution.js
- In resolveNight: check nightActions.playerEliminate
- If set: mark that character dead, add to deathLog with cause: "player_eliminate", add to confirmedRoles
- Cannot eliminate already-dead characters or the player themselves

### src/components/NightScreen.jsx — rewrite

Two sections:
- "Investigate" section (existing): learn role at dawn
- "Eliminate" section: kill someone tonight, red styling, "cannot be undone" label
- Both optional, independent choices (can do both as long as targets differ)
- "Pass" button at bottom
- data-testid="eliminate-{npc.id}" on eliminate buttons

### src/components/App.jsx
- Add handleEliminate callback using setNightAction with "playerEliminate"
- Pass onEliminate to NightScreen
- handleInvestigate and handleSkipInvestigation: also call resolveNight after setting both actions

Wait — the existing flow calls resolveNight when investigate is chosen. With two separate actions, we need to handle this carefully:
- User picks investigate target → stored but not resolved yet
- User picks eliminate target → stored but not resolved yet  
- User clicks "Confirm night actions" or "Pass" → resolveNight called once with all actions set
- Simplest: add a "Confirm" button that calls resolveNight with whatever is currently set (may be null for either action)

### src/components/DawnScreen.jsx
- Add display for player_eliminate result: "You eliminated [name]. They were a [role]."

---

## 5. ALLIANCE — Instant knowledge dump + mafia = game over

### src/engine/winCondition.js — update formAlliance

When allied character IS mafia:
- Return state with gameOver: true, winner: "mafia", winReason: "inspector_revealed"
- Do NOT set alliedWithInspector on the character (game is over)

When allied character is innocent:
- Dump character.knowledgeState.witnessed to evidence board as ally_observation entries
- Dump character.testimony observations to evidence board as ally_intel entries  
- Set alliedWithInspector: true
- Add to evidenceBoard.alliances
- Set mafiaKnowsInspector stays false (they're innocent)

ally_observation entry structure:
```js
{ type: "ally_observation", allyId, allyName, subjectId, subjectName, location, day, chunk }
```

### src/components/App.jsx — handleAlliance
After formAlliance, if returned state has gameOver: true, transition to GAME_OVER phase immediately.

### src/components/GameOverScreen.jsx
Add "inspector_revealed" winReason: "You revealed yourself to a mafia member. The village is lost."

---

## 6. ALLY WITNESS STREAM

### src/engine/npcMovement.js — after moveNPCs completes

After all NPCs move, scan for allies (characters where alliedWithInspector === true and alive).
For each ally, look at their new location and who else is there.
Add ally_observation entries to evidenceBoard for each character the ally can now see.

Or simpler: hook into moveCharacter in movement.js — after the knowledgeState.witnessed entries are created, if the mover is an ally, ALSO add those as ally_observation entries to the evidenceBoard.

### src/components/EvidenceBoard.jsx
Show ally_observation entries with green color and ally name as source label.
Keep existing movementLogs display (player observations, blue).

---

## 7. CONFIGURABLE CONVERSATIONS

### src/engine/gameState.js
- createGameWithSetup accepts config.conversationsPerDay (2, 3, 4), stores as state.conversationsPerDay
- getConversationsAvailable uses state.conversationsPerDay || BASE_CONVERSATIONS_PER_DAY as base

### src/components/SetupScreen.jsx
Add "Conversations per Day" selector: 2 / 3 / 4 buttons. Default 3. Pass in config.

---

## 8. CONTRADICTION AUTO-FLAGGING

### src/engine/evidenceBoard.js

Add runContradictionCheck(board) function:
- Look at all claimedFacts of type "location_claim"
- For each, check if movementLogs has an observation of the same character at a DIFFERENT location on the same day/chunk
- If mismatch: add contradiction entry (if not already present)

Call runContradictionCheck in App.jsx handleLogConversation after adding claimedFacts.

---

## TESTING

Update any tests that break because of the phase change (VOTE -> NIGHT in advanceChunk).
Add new unit tests:
- testimony.js: generateTestimony for innocent produces no lies
- testimony.js: generateTestimony for mafia produces at least 1 lie
- nightResolution.js: playerEliminate kills target, adds to deathLog with cause "player_eliminate"
- winCondition.js: formAlliance with mafia returns gameOver: true immediately
- winCondition.js: formAlliance with innocent dumps witnessed entries to evidenceBoard

Run `npm test` and fix all failures before finishing.

When done run: openclaw system event --text "Done: Inspector overhaul - testimony, monologue convos, night eliminate, ally stream, no vote" --mode now
