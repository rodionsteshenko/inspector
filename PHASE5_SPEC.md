# Phase 5 — Game Setup & Playable Loop

## Goal
A complete playable game from start to finish with a real setup screen.
Small roster, tight loop, actually fun to play.

---

## Screen 1: New Game / Setup Screen

### Layout
Full screen, dark atmospheric. Three sections:

**1. Map Preview**
- Show the village map (same SVG as game view)
- Animated — characters appear as dots, scatter to starting positions
- Purely visual, not interactive here

**2. Player Count**
- Slider or button toggle: 6 / 8 / 10 / 12 players
- Default: 8

**3. Role Selection**
- Show available roles as cards (icon + name + one-line description)
- Toggle on/off
- System enforces minimum valid composition (at least 2 mafia, at least 1 inspector)
- Balance indicator: green (fair) / yellow (mafia-favored) / red (unbalanced)
- Recommended preset button: "Balanced" auto-selects a good set for the chosen player count

**4. Start Game button**
- Only enabled when composition is valid
- Transition: map zooms in, characters walk to starting positions, day 1 begins

---

## Starter Role Set (8 players)

Keep it tight for V1 playable:

| Role | Count | Why |
|------|-------|-----|
| Inspector | 1 | You |
| Mafia Killer | 2 | Core threat |
| Doctor | 1 | Protective ally to find |
| Mason | 1 | Free confirmed innocent — teaches trust mechanic |
| Journalist | 1 | Extra conversations — teaches alliance mechanic |
| Citizen | 2 | Padding, pure deduction |

Total: 8. Balanced. Every mechanic gets represented.

---

## Screen 2: Character Reveal

After setup, brief screen showing:
- All 8 character names and portraits (or placeholder icons)
- YOUR character highlighted: "You are the Inspector"
- Everyone else: "???" — roles hidden
- Flavor text: "You arrive in the village of Ashenmoor. Two killers walk among you."
- [Begin Day 1] button

---

## The Game Loop (complete, no placeholders)

### Day Phase
1. Map view — you see your location, other characters as dots
2. Action menu — move, talk, observe (all wired to real game state)
3. Characters move independently each chunk based on their role goals:
   - Mafia: try to meet each other once per day, then find their target
   - Doctor: stays near high-traffic areas, watching who looks threatened
   - Citizens: semi-random, personality-driven
4. 8 chunks per day

### End of Day: Vote
- Summary of the day: who you talked to, what you observed
- Vote panel: pick one character to nominate
- Other characters vote based on their suspicion state (AI-driven)
- Majority eliminates — role revealed

### Night Phase
- Night screen: pick one person to investigate
- Mafia resolves kill (only if they met + reached target during the day — poisoning mechanic)
- Doctor resolves protection

### Dawn
- Who died (if anyone)
- Your investigation result
- New day begins

### Win/Lose
- Win: both mafia voted out
- Lose: mafia reaches parity OR you're killed OR day 5 ends

---

## Poisoning Mechanic (implement now)

Replace the abstract night kill with the physical proximity system:

**Mafia behavior each day (AI-driven):**
1. Chunk 1-4: mafia members independently route toward each other
2. When they share a location: coordination happens (logged internally, not shown to player)
3. Chunk 5-8: one mafia member routes toward the chosen target
4. If they reach the target's location: poison administered (logged as a normal interaction)
5. If they can't reach target by end of day: NO KILL that night

**Evidence trail:**
- After a death, evidence board flags: "Characters who shared a location with [victim] on day of poisoning"
- Mafia meeting is logged as a normal co-location — suspicious in retrospect
- Player can look back at movement logs and spot the pattern

**Skip or substitute:**
- If mafia can't reach primary target: they can switch to anyone they DID reach that day
- This means hiding/moving around a lot actually protects people

---

## What to Build

1. Setup screen (map preview + player count + role cards + start button)
2. Character reveal screen
3. Poisoning mechanic in movement/nightResolution engine
4. Evidence board: post-death proximity flag ("who was near victim")
5. Mafia AI: daily pathfinding toward partner then target
6. Vote screen: summary + nomination + result
7. Win/lose screens with full role reveal
8. New game flow (reset state, re-randomize roles)

## Testing
- All 222 existing tests must pass
- New unit tests: poisoning proximity detection, mafia pathfinding logic, vote resolution
- Integration test: full 3-day game, mafia kills on day 2, innocent voted out day 1, inspector wins day 3
- E2E: setup screen → start game → complete day 1 → night → dawn → vote

When done: openclaw system event --text 'Done: Mafia game Phase 5 complete - playable game loop' --mode now
