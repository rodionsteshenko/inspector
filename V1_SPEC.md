# Mafia Game — V1 Spec

## Vision

A single-player social deduction game. You're an inspector in a village where two mafia
members are hiding among ordinary people. You move through the village, talk to people,
piece together who's who, and try to get the right person voted out before the mafia
eliminates you or wins by numbers.

The fun is in the conversations, the moments of discovery, and the story that emerges.
Not a puzzle with a perfect solution — a messy human situation where you do your best.

---

## The Setup

- 12 characters, randomly assigned roles each game
- You are always the Inspector
- 2 Mafia members (know each other, coordinate kills)
- 1 Doctor (protects one person per night)
- 1 Journalist (gives you an extra interview slot per day)
- 1 Mason (knows one confirmed innocent at game start)
- 6 Citizens (no special ability)
- Game lasts 5 days (can be shortened to 3 for a faster game)

---

## The Map (V1)

8 locations connected by adjacency. Click to move — one move per chunk.

```
        [Church]
           |
[Docks]--[Town Square]--[Market]
           |                |
        [Tavern]        [Library]
           |
         [Alley]
           |
         [Cellar]
```

Each location has:
- A name and short flavor description
- Capacity (Town Square holds 6, Cellar holds 2)
- Visibility level (public vs. private)

---

## A Day — How It Actually Plays

### The Clock
8 chunks per day. Each chunk you make one decision.

### Your Turn Each Chunk

The screen shows:
- The map (where you are, where others were last seen)
- Who is currently in your location
- A simple action menu

**If you're alone:**
- Move to an adjacent location
- Wait / observe (you notice details about who passes through)

**If others are in your location:**
- Move to an adjacent location (you leave)
- Talk to [Character Name] — opens a conversation
- Observe quietly (you watch interactions without joining — Tier 2 info)

That's it. Two or three choices max per chunk.

---

## Conversations

When you talk to someone, you get a chat-style exchange.
They respond in character — their personality, what they know, what they've seen.

You can:
- Ask them about a specific person ("What do you think of Viktor?")
- Ask about a location ("Were you near the docks yesterday?")
- Ask what they observed ("Did you notice anything unusual today?")
- Reveal yourself as the inspector (see Alliance section)
- End the conversation

The conversation ends naturally after a few exchanges, or when you choose to leave.
What they tell you is logged to your evidence board automatically.

**What you observe without talking:**
If you're in the same room and don't engage, you still see:
- Who talked to whom
- Roughly how long
- One line of body language: "They seemed tense." / "She did most of the talking."

---

## Nightfall

After chunk 8, night resolves automatically:

1. Mafia picks a kill (you don't see this — you find out at dawn)
2. Doctor picks someone to protect
3. **You pick one person to formally investigate** — you learn their exact role
4. Results are held until morning

---

## Dawn

- Announcement: who was killed (if anyone — doctor might have saved them)
- Your investigation result is revealed to you privately
- New day begins

---

## The Vote

Once per day (at the end of the day, before nightfall) the village votes.
Everyone nominates one suspect. Majority vote eliminates that person.
Eliminated character's role is revealed.

You vote too. You can try to influence others during the day through conversation.

---

## Your Special Abilities

### Nightly Investigation (1 per night, base)
Pick any character. Learn their exact role. Privately — no one else knows you checked.

### Alliance
When you trust someone enough:
- Tell them you're the inspector during a conversation
- They reveal their role back to you (mutual handshake)
- Their future testimony is fully reliable (no hidden agenda)
- They cannot tell anyone else who you are (locked by game rules)
- You gain access to their ability (see below)

### Alliance Abilities by Role

| Role | What You Gain |
|------|--------------|
| Journalist | +1 conversation slot per day (talk to one extra person) |
| Doctor | You see who she's protecting each night — coordinate coverage |
| Mason | Immediately learn his one confirmed innocent |
| Citizen (well-positioned) | Their verified observations fill map blind spots |

**Risk:** If you ally with a Mafia member by mistake, they know who you are.
You become their kill priority. You'll likely die the next night.

---

## Information & The Evidence Board

### How Information Works
- **In a conversation:** full content, everything said
- **In the room, not talking:** who spoke to whom, duration, one body language note
- **Heard from someone else:** filtered through their perspective — reliable only if they're verified innocent

### Verified Innocents
Once you've investigated someone and confirmed they're innocent:
- Everything they tell you is true (they have no agenda)
- BUT: they only know what they witnessed
- They can misread what they saw
- They might not volunteer everything (fear, self-protection)
- They can be honestly wrong about their own suspicions

### The Evidence Board
Auto-populates with hard facts only:
- Movement log: where each character was seen, by whom, at what time
- Contradiction flags: "Elena claims she was alone. Viktor saw two people."
- Confirmed roles: characters you've investigated
- Death log: who died, when, where they were last seen
- Your alliance list: who you've mutually revealed to

The board doesn't tell you what to think.
It shows you the logical impossibilities. You draw the conclusions.

---

## Win / Lose Conditions

**You win:** Both mafia members are voted out (doesn't have to be same day)

**You lose:**
- You are killed by the mafia
- Mafia reaches numerical parity with innocents (they can outvote the village)
- 5 days pass without eliminating both mafia members

---

## The UI Flow

### Main Screen
```
+---------------------------+------------------+
|                           |                  |
|         MAP               |  EVIDENCE BOARD  |
|   (click to move)         |                  |
|                           |  Confirmed roles |
|  [You are here: Tavern]   |  Movement logs   |
|  Also here: Brad, Elena   |  Contradictions  |
|                           |                  |
+---------------------------+------------------+
|           ACTION MENU                        |
|  > Talk to Brad                              |
|  > Talk to Elena                             |
|  > Observe quietly                           |
|  > Move to: Town Square / Alley              |
+----------------------------------------------+
```

### Conversation Screen
```
+------------------------------------------+
|  BRAD THE BARBER                [Day 2]  |
|  ----------------------------------------|
|  Brad: "Quiet morning. You hear about    |
|  what happened at the docks last night?" |
|                                          |
|  > "What did you hear?"                  |
|  > "Were you near the docks yourself?"   |
|  > "What do you think of Viktor?"        |
|  > [End conversation]                    |
+------------------------------------------+
```

Conversation choices are generated dynamically based on context —
what you already know, who's been suspicious, what's happened recently.

### Night Screen
```
+------------------------------------------+
|           NIGHTFALL                      |
|                                          |
|  The village goes quiet.                 |
|                                          |
|  Who do you investigate tonight?         |
|  > Viktor the Farmer                     |
|  > Sonya the Widow                       |
|  > Mira the Merchant                     |
|  > [other characters]                    |
+------------------------------------------+
```

### Dawn Screen
```
+------------------------------------------+
|              DAWN — Day 3                |
|                                          |
|  The village wakes to grim news.         |
|  Anya the Seamstress was found dead      |
|  near the alley.                         |
|                                          |
|  Your investigation result:              |
|  Viktor the Farmer — CITIZEN             |
|                                          |
|  [Begin Day 3]                           |
+------------------------------------------+
```

---

## What Makes Each Game Different

- Roles are randomly assigned to named characters each playthrough
- Brad might be mafia this game, innocent the next
- The mafia's strategy adapts to what you do
- Who the doctor protects, who the mason knows — all random
- The story that emerges is always different

---

## What's NOT in V1

Keep it simple. Save these for later:

- Virus / infection mechanic (Devil's Plan)
- Fanatic role
- Multiple factions
- Dead player participation
- Character relationship biases
- Custom map editor
- Multiplayer

---

## Tech Stack (to decide)

- Web app (React + Vite, like Loom and Newsly)
- LLM backend for character conversations (Claude)
- Game state managed server-side or local JSON
- Map rendered as interactive SVG or simple CSS grid
- Evidence board as structured data rendered as cards
