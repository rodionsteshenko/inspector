# Mafia Game — Design Document

## Concept

A single-player social deduction game set in a village. You are the Inspector. 
The other characters are AI agents — each with a name, personality, and a secretly assigned role. 
You don't know who anyone is. You have to figure it out before it's too late.

---

## Source Material: Classic Mafia / Werewolf Rules

Traditional Mafia alternates between two phases:
- **Night:** Mafia secretly picks a kill. Special roles act covertly (inspector investigates, doctor heals).
- **Day:** Everyone debates and votes to eliminate a suspect. Eliminated player reveals their role.

Win conditions:
- **Innocents win:** All mafia members eliminated
- **Mafia wins:** They equal or outnumber innocents

Classic roles:
- **Citizen/Villager** — no special ability, pure social deduction
- **Inspector/Detective/Seer** — investigates one person per night, learns alignment
- **Doctor/Guardian** — protects one person from being killed each night
- **Mafia/Werewolf** — knows teammates, picks kills at night
- **Cupid** — links two lovers; if one dies, both die
- **Mason** — knows other Masons, confirmed innocent
- **Mayor** — vote counts double
- **Jester/Drunken Idiot** — wins if voted out (neutral chaos role)

---

## Our Version: Key Differences

### Setting
Not a courtroom vote — a living village. Characters move through a connected map.
Day is broken into 15-minute chunks (8 chunks = 2 hours). 
Night resolves events and resets for the next day.

### You Are the Inspector
This is the central question of the design — how does the player actually *play*?
See "Inspector Modes" section below.

### AI Agents, Not Coins
Every character is an AI agent with:
- A name (e.g. "Brad the Barber", "Elena the Innkeeper")
- A personality trait (cautious, chatty, paranoid, warm, calculating...)
- A secretly assigned role (mafia, citizen, doctor, etc.)
- A knowledge state — what they've seen, heard, and inferred
- A memory of who they talked to and what was said
- A motivation driven by their role (mafia: hide and coordinate; doctor: protect someone; citizen: survive and trust)

Characters act *in character* at all times. The mafia member doesn't act suspicious — 
they act like their personality, which might be warm and helpful, while secretly coordinating murders.

---

## The Map

A village with ~8-10 locations connected by edges (adjacency). 
Movement costs 1 chunk. You can only move to adjacent nodes — no teleporting.
This means movement trails are evidence.

### Sample Map

```
         [Church]
            |
[Docks] -- [Town Square] -- [Market]
            |                  |
          [Tavern]         [Library]
            |
          [Alley]
            |
          [Cellar]
```

Location properties:
- **Capacity** — some hold 6 people, some only 2-3 (creates intimacy)
- **Visibility** — public spaces (Town Square, Market) are observable by many; 
  private spaces (Cellar, Alley) are hard to monitor
- **Traffic** — certain locations draw specific character types by default

Characters move independently each chunk based on their goals and personality.
High-traffic locations = more observations but less privacy.
Low-traffic locations = private conversations but suspicious to be seen heading there.

---

## Information Tiers

How you learn things depends entirely on *where you are* relative to the action:

### Tier 1: In the Conversation
You were part of it. You know everything said. Full content.

### Tier 2: In the Room, Not in the Conversation
You see who talked to whom, for how long, and read body language.
- "Marcus and Elena talked for two chunks. Marcus kept glancing at the door."
- "She laughed a lot. It seemed comfortable, like they know each other well."
- You get vibes, duration, observable behavior. No content.

### Tier 3: Heard About It Later
Only what someone *chose* to tell you, filtered through their agenda.
A mafia member can lie. A nervous citizen might omit things.
A doctor might tell you something specifically to mislead.

**The map is evidence too.**
If Elena claims she was in the Cellar at chunk 3, but she was seen leaving the Docks at chunk 1,
and the only path from Docks → Cellar goes through Town Square → Alley (3 moves minimum),
she couldn't have made it. She's lying — or someone else is lying about seeing her.

---

## Inspector Modes — The Core Design Question

This is the biggest design decision. Four possible versions:

### Mode A: Embedded Inspector (Hidden Role)
- You're one of the villagers. No one knows you're the inspector.
- You move through the map like everyone else.
- Each chunk, you can choose one person in your current location to have a private conversation with.
- At night, you get one "official" investigation: pick any player, learn their alignment (innocent/mafia).
- You gather evidence through normal social interaction AND your nightly investigation.
- Risk: mafia might kill you specifically if they figure out who you are.

**Pros:** Most immersive. You experience the village from the inside.  
**Cons:** You can be killed. You're limited by where you physically are.

---

### Mode B: Observer Inspector (God's Eye + Limited Influence)
- You exist outside the normal flow. You watch events unfold on the map.
- Each chunk you can choose ONE location to "observe" — you see everything that happens there.
- Once per day, you can request an interview with one character (they come to you).
- You cannot be killed. You're the investigator, not a participant.
- Your job is purely analytical — you're watching and interviewing, not socializing.

**Pros:** Clean deduction game. You control information gathering more surgically.  
**Cons:** Less social, less personal risk, potentially less tense.

---

### Mode C: Post-Hoc Inspector (Interview After the Fact)
- Each night, one person is killed. You don't witness it.
- The next morning you're told who died. Now you investigate.
- You interview witnesses — characters who were in relevant locations describe what they saw.
- You can cross-reference their accounts, catch contradictions, follow movement trails.
- Think: detective arriving after the crime, not preventing it.

**Pros:** Classic detective fiction feel. Pure deduction. No real-time pressure.  
**Cons:** Reactive rather than proactive. Less agency.

---

### Mode D: Participant Inspector (Hybrid — Recommended)
- You are embedded, moving through the village like everyone else.
- No one knows your role unless you reveal it (you can choose to).
- You can have conversations with anyone in your current location.
- Observations of others in your location are automatic (Tier 2 info).
- **Nightly ability:** Choose one person to formally inspect — learn their exact role, not just alignment.
- **Risk:** Mafia knows there's an inspector in the game (it's a fixed role). 
  If they figure out it's you, you're a target.
- **Trade-off:** Revealing yourself to trusted allies gets you more info but paints a target.

**Pros:** Best of all worlds. Social deduction + physical presence + deductive ability.  
**Tension:** Do you reveal yourself to build a coalition, or stay hidden to stay alive?

---

## Recommended Starting Mode: Mode D (Participant Inspector)

You're in the village. You move, observe, and talk like anyone else.
You have one powerful nightly ability (learn exact role of one person).
Mafia knows an inspector exists but not who. You have to find them before they find you.

---

## Character Roster (Sample, 12 players)

Named to feel like real villagers, roles secretly assigned each game:

| Name | Archetype | Personality |
|------|-----------|-------------|
| Brad the Barber | chatty hub | knows everyone's business, talks too much |
| Elena the Innkeeper | warm but strategic | trusts slowly, notices everything |
| Father Gregor | moralistic | suspects everyone, quotes scripture when nervous |
| Mira the Merchant | calculating | trades information like goods |
| Old Tomas | paranoid | jumps to conclusions, rarely wrong |
| Dasha the Healer | protective | deflects questions, focuses on others' safety |
| Lev the Dockworker | quiet | says little, sees more than people think |
| Anya the Seamstress | gossipy | shares too much, hard to know what's true |
| Piotr the Miller | conflict-averse | smooths things over, hates accusation |
| Nadia the Librarian | analytical | collects facts, slow to commit to a theory |
| Viktor the Farmer | blunt | says exactly what he thinks, sometimes wrong |
| Sonya the Widow | mysterious | knows more than she lets on, keeps secrets |

---

## Roles in This Version

| Role | Team | Ability |
|------|------|---------|
| Inspector | Innocents | You. Learn exact role of 1 person per night. |
| Citizen | Innocents | No special ability. Pure social deduction. |
| Doctor/Healer | Innocents | Each night, protects 1 person from being killed. |
| Mason | Innocents | Knows 1 other confirmed innocent (pre-game). |
| Mafia x2 | Mafia | Coordinate secretly. Each night, pick 1 person to kill. |
| Jester | Neutral | Wins if voted out by the group. Causes chaos. |
| Fanatic | Mafia-aligned | Appears innocent. Cannot kill. But if inspector reveals to them, silently alerts mafia handler. |

Optional additions for later:
- **Carrier** — unknowingly infected, spreads a virus (Devil's Plan mechanic)
- **Researcher** — works to find the cure for the virus
- **Immune** — naturally resistant to the virus

---

## Turn Structure

### Daytime (8 chunks × 15 min)

Each chunk:
1. All characters (including you) are at a location
2. Automatic Tier 2 observation — you see who's with you, who talks to whom, body language
3. You choose an action:
   - **Talk** to one person in your location (Tier 1 — full conversation)
   - **Move** to an adjacent location
   - **Observe** — stay quiet, gather more Tier 2 info on everyone present
4. AI characters independently make the same choices based on their goals

### Nightfall

1. Movement stops. Everyone is where they are.
2. Mafia secretly coordinates — picks a kill target
3. Doctor picks someone to protect
4. You pick someone to inspect — learn their role
5. Resolution: kill happens (unless doctor covered them), results revealed at dawn

### Dawn

1. Announcement: who (if anyone) was killed overnight
2. New day begins
3. Group discussion — everyone shares what they know (or want you to think they know)
4. Vote to eliminate a suspect (majority rules)
5. Eliminated player's role is revealed

---

## Agent AI Behavior by Role

### Mafia Agent
- Goal: eliminate inspector, kill innocents, avoid detection
- Behavior: acts warm and cooperative in public, routes to private spaces to coordinate
- Will lie about where they were, what they saw, who they talked to
- If their partner is accused, they'll defend them or sacrifice them strategically

### Doctor Agent
- Goal: keep key innocents alive (especially the inspector if identified)
- Behavior: gathers information about who's in danger, moves toward threatened characters
- Cautious about revealing their role (makes them a mafia target)

### Citizen Agent
- Goal: survive, gather information, vote correctly
- Behavior: driven by personality — paranoid citizens accuse quickly, conflict-averse ones follow consensus
- Genuinely doesn't know anything unless they witnessed something

### Mason Agent
- Goal: find their confirmed innocent partner, build a trust coalition
- Behavior: moves to find their partner early, shares confirmed info carefully

### Jester Agent
- Goal: seem suspicious enough to get voted out
- Behavior: drops hints, acts weird, wants accusation — but not too obviously or it's dismissed as a joke

---

## The Murder Mechanic — Poisoning

Kills don't happen magically at night. They require **physical setup during the day.**

### How It Works

**Step 1: Mafia must meet**
The two mafia members need to be in the same location at least once during the day to coordinate their target. They can't just telepathically agree — they have to physically find each other.

This means they're moving toward each other on the map, which creates observable patterns:
- Two characters who keep ending up in the same location
- Routing through less-watched areas to avoid witnesses
- If you see them together twice in one day, that's suspicious

**Step 2: One mafia member must get close to the victim**
To poison someone, one mafia member needs to be in the same location as the target at some point during the day — they administer the poison in passing. A handshake, a shared drink, a brush in a crowd.

This means:
- They have to track down their target, move toward them
- If the target moves around a lot, the mafia might not get a clean opportunity
- If the target is always surrounded by allies, the approach is risky
- **If they can't reach the target that day, no kill happens that night**

**Step 3: The poisoning is subtle but potentially observable**
The mafia member was in the same location as the victim. That's a fact. It goes in the movement log.
The interaction itself looks normal — they talked, they passed each other, nothing obviously wrong.
But in retrospect, if someone dies tonight, you can look back and ask: who was near them today?

**What this means for the evidence board:**
After a death, the board automatically flags: "Characters who shared a location with [victim] on day X"
That's not proof — lots of innocent people might have been near them.
But it's a starting point.

**What this means for mafia strategy:**
- They need to coordinate (meet up) without being seen meeting up
- They need to reach their target without being seen targeting them
- Choosing targets who are isolated and moving through less-observed routes
- If you've been protecting someone (keeping them in public, surrounded by allies), the mafia literally can't poison them

**What this means for you:**
- Watch for characters who keep ending up together
- Watch for characters who seem to be tracking someone else's movements
- A mafia member who "happened" to be near the victim three times in one day isn't a coincidence
- You can physically protect a target by staying near them — makes poisoning too risky

---

## What Makes This Different From Classic Mafia

1. **Physical movement matters** — alibis can be verified or broken by the map
2. **AI agents are motivated, not random** — they pursue goals, lie strategically, remember conversations
3. **Information is partial and situated** — you only know what you can see from where you are
4. **The inspector role is flexible** — reveal yourself to build alliances or stay hidden to survive
5. **No moderator** — the game engine tracks ground truth; agents only know what they've witnessed

---

## The Alliance System — Core Mechanic

### Mutual Reveal
Revealing your role is a two-way handshake. When you tell someone you're the inspector,
they tell you their role back. Neither can pass the other's identity to a third party —
it's a sealed pact, locked by game mechanic.

This means: you don't just gain information, you gain a *confirmed ally*.

### Ability Sharing Through Alliance
When you ally with someone, you gain access to their special knowledge and abilities:

| Allied Role | What You Gain |
|-------------|--------------|
| Doctor | Knows who she's protecting each night — you can coordinate (keep her alive = keep the shield) |
| Mason | Already has one confirmed innocent — hands you that certainty for free |
| Sharp Citizen | Their accumulated observations fill your map blind spots |
| Researcher | Knows who's infected and who might be immune (virus variant) |

The right alliance network multiplies your coverage. You can split up across the map,
each covering different locations, and pool observations each night.

### The Fanatic — The Traitor Role
A character who appears completely innocent. Consistent behavior, no suspicious movement,
passes casual scrutiny. But secretly aligned with the mafia — not a killer, a true believer.

If you reveal to a fanatic:
- They can't tell other villagers (sealed pact)
- But they whisper it to their mafia handler privately
- You've just handed the mafia a confirmed kill target: you

**This is why your nightly investigation is a vetting tool, not just a detection tool.**
Before you reveal to anyone, investigate them first. Inspect Brad before you trust Brad.

### The Trust Deduction Loop
Before allying with someone, evaluate:
1. **Movement** — do they seek private spaces or stay in public? Who do they route toward?
2. **Associations** — who *they* spend time with. Guilty by proximity.
3. **Information quality** — are they sharing genuinely useful observations or steering you?
4. **Consistency** — do their claimed locations match what you've observed on the map?
5. **Then:** investigate them at night. If clean, reveal the next day.

### The Core Tension
Every alliance makes you stronger AND more exposed.
The right allies win you the game. One fanatic ends it.

---

## The Reveal Mechanic

### How You Prove You're the Inspector
You don't just claim it — you have receipts. Your investigation results are your proof.
"I inspected Brad last night. He's a citizen." No one else could know that.
Your confirmed role-knowledge is unforgeable evidence of who you are.

### Visibility Risk
Even if no one betrays you verbally, a long private conversation *looks* like something.
Characters observing from the same room see duration and body language (Tier 2 info).
A tactical alliance meeting in the cellar signals alliance to anyone watching — 
mafia can deduce who you might be through your movement patterns alone,
without ever being told directly.

So the meta-game: reveal in a way that doesn't *look* like a reveal.
A casual public conversation doesn't signal alliance. A 30-minute cellar meeting does.

---

## Open Design Questions

1. **Do characters know you're the inspector?** (Role hidden by default, but revealable)
2. **Can the mafia recruit?** (Some variants allow converting citizens — adds mid-game complexity)
3. **How many days before the game ends?** (Fixed number of days, or until one side wins?)
4. **Does the virus mechanic (Devil's Plan) replace or augment the kill mechanic?**
5. **Can dead characters continue to observe?** (Blood on the Clocktower does this — keeps eliminated players engaged)
6. **What does the UI look like?** — map view, conversation interface, evidence board?

---

## Next Steps

- [ ] Finalize inspector mode (recommend Mode D)
- [ ] Design the map graph (nodes, edges, capacity, visibility)
- [ ] Define agent personality × role behavior matrix
- [ ] Build the knowledge/belief system for agents
- [ ] Design the conversation interface (how do you actually talk to Brad the Barber?)
- [ ] Build the movement engine (pathfinding, observation logging)
- [ ] Wire up the night resolution engine
