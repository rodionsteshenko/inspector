// Conversation question types and character response data for Phase 3 (placeholder, pre-LLM)

export const QUESTION_TYPES = {
  WHEREABOUTS: 'whereabouts',
  NIGHT_ACTIVITY: 'night_activity',
  SUSPICIONS: 'suspicions',
  ALIBI: 'alibi',
};

export const QUESTIONS = [
  { id: 'whereabouts',    text: 'Where were you this morning?',                     type: QUESTION_TYPES.WHEREABOUTS },
  { id: 'night_activity', text: 'Did you notice anything unusual last night?',       type: QUESTION_TYPES.NIGHT_ACTIVITY },
  { id: 'suspicions',     text: 'Who do you think is behind the killings?',          type: QUESTION_TYPES.SUSPICIONS },
  { id: 'alibi',          text: 'Can anyone confirm your whereabouts?',              type: QUESTION_TYPES.ALIBI },
];

// 2–3 personality-consistent responses per question per character.
// Phase 4 will replace these with live LLM calls.
const CHARACTER_RESPONSES = {
  brad_barber: {
    whereabouts: [
      "Ha! Everyone knows where I am — the shop, of course. Had six customers this morning. Even saw the Miller pass by twice, which was odd.",
      "Market first thing, then back to the shop. Business has been slow — people are nervous. You can tell by who stops getting haircuts.",
    ],
    night_activity: [
      "Well, between you and me — I heard something near the alley last night. Didn't see who. Could've been nothing. Or something.",
      "I was up late. Couldn't sleep. Saw a light moving across the square around the second hour. Didn't dare go out, though.",
    ],
    suspicions: [
      "If you ask me — and you are asking me — watch the quiet ones. They always know more than they let on.",
      "I've been thinking. Someone who moves around a lot but nobody remembers seeing. That's who I'd look at.",
      "Honestly? I have three suspects in my head. But names get people killed these days, so I'm keeping them to myself a bit longer.",
    ],
    alibi: [
      "Half the village has sat in my chair this week. Ask any of them.",
      "My neighbor Elena can vouch for me — we had words about the fence between our properties. Unpleasant, but it's an alibi.",
    ],
  },

  elena_innkeeper: {
    whereabouts: [
      "At the inn all morning. Where else would I be? I have guests to feed and a business to run. I notice everything from behind that bar.",
      "Market, then the inn. I keep regular hours. Reliability is how you survive in this trade.",
    ],
    night_activity: [
      "I heard footsteps after midnight. Heavy boots. Whoever it was moved with purpose. I noted it.",
      "Two people left the inn separately within minutes of each other. I won't say who yet — I'm still watching.",
    ],
    suspicions: [
      "I've run this inn for fifteen years. I can read people. Someone is lying — and they're very good at it. That narrows it down considerably.",
      "Don't be fooled by friendliness. The most agreeable person in a room is often the most dangerous.",
    ],
    alibi: [
      "I had three guests at dinner who can confirm my presence.",
      "Mira was with me in the evening — we discussed a supply arrangement. Ask her.",
    ],
  },

  father_gregor: {
    whereabouts: [
      "I was at the church, where I always am. 'Let your light shine before men.' I have nothing to hide.",
      "Morning prayers, then visiting the sick. Two witnesses at each stop. I keep God's schedule.",
    ],
    night_activity: [
      "I pray for this village every night. Last night I heard something that troubled my spirit. 'Be sober, be vigilant; your adversary prowls.' I took it as a sign.",
      "There are wolves among us, Inspector. I have felt it. Last night confirmed my fears.",
    ],
    suspicions: [
      "Suspicion is a sin — but so is blindness. Scripture says 'by their fruits ye shall know them.' Watch how people act when they think no one is watching.",
      "I suspect no one and everyone. That is the honest truth. Evil rarely announces itself.",
    ],
    alibi: [
      "God is my alibi. And also the deacon, who assisted at evening vespers.",
      "The church records show I was officiating. Come see for yourself.",
    ],
  },

  mira_merchant: {
    whereabouts: [
      "Market. Library to check records. Market again. Information is my trade, same as yours.",
      "I was at the docks meeting a contact. Commercial matters. Boring to you, vital to me.",
    ],
    night_activity: [
      "I saw what I saw and I'm still deciding what it's worth. Give me a reason to tell you.",
      "A merchant doesn't give information away. But I'll say this — the north side of the square was busy last night, when it shouldn't have been.",
    ],
    suspicions: [
      "I trade in facts, not suspicions. But I've been watching the money flow — and money always tells the truth.",
      "Someone in this village is being paid, or paying. Follow that thread.",
    ],
    alibi: [
      "I have receipts. Signed, dated, witnessed. Would you like to see them?",
      "Viktor was at my stall arguing until past dark. Ask him — though he'll complain about the prices first.",
    ],
  },

  old_tomas: {
    whereabouts: [
      "The docks, the square, the market. I go where my feet take me. I watch.",
      "The tavern, then the square, then home. My knees aren't what they were, but my eyes still work perfectly.",
    ],
    night_activity: [
      "Saw them! Moving through the alley. You'll say I'm imagining things. I never imagine things.",
      "Something woke me at the third hour. Too deliberate to be wind. Someone was out there — moving carefully, because they knew they shouldn't be seen.",
    ],
    suspicions: [
      "The one who laughs too easily. Happiness in a time of fear is suspicious. Mark my words.",
      "I've narrowed it to three people. I'll keep my own counsel until I'm certain — the last time I accused someone I was right, and nobody thanked me.",
    ],
    alibi: [
      "I was alone. I'm always alone. That's the curse of being the only one who sees clearly.",
      "No alibi. Don't need one. I know who the guilty party is, and it isn't me.",
    ],
  },

  dasha_healer: {
    whereabouts: [
      "House calls. I check on the elderly each morning. They need me more than I need an alibi.",
      "My rounds were longer today — two sick children. I was barely in my own house.",
    ],
    night_activity: [
      "I was called out — someone was ill. I was focused on the patient, not on what might be happening outside.",
      "Healers don't sleep well. I was awake, but I try not to see trouble where there may be none.",
    ],
    suspicions: [
      "I've bound the wounds of everyone in this village at some point. I know more than you think. But names... I can't speak names lightly.",
      "Someone is afraid. I can see it in how they hold themselves. Fear and guilt look similar — but they aren't the same.",
    ],
    alibi: [
      "My patients can confirm my whereabouts. I won't name them unless necessary — medical discretion.",
      "Father Gregor saw me at the mill family's house. Ask him.",
    ],
  },

  lev_dockworker: {
    whereabouts: [
      "Docks. Same as every day.",
      "Working. Where else would I be.",
    ],
    night_activity: [
      "Heard something at the water's edge. Didn't investigate. Wasn't my business.",
      "Quiet night. Mostly. Hard to say.",
    ],
    suspicions: [
      "I notice things. Don't always say them.",
      "You're asking the wrong person. But... watch who visits the cellar after dark.",
    ],
    alibi: [
      "The foreman. Ask him. I was loading crates until dark.",
      "The other dockworkers were with me. We work together.",
    ],
  },

  anya_seamstress: {
    whereabouts: [
      "Oh! I was everywhere — the market, a quick visit to Elena's, then the church — Father Gregor was very mysterious, by the way — then my shop.",
      "You know, I saw so many people. I could tell you things. Actually I probably shouldn't. Not all of it.",
    ],
    night_activity: [
      "I heard two people arguing near the alley. I couldn't make out the words but the tone was... conspiratorial. Should I be more specific?",
      "I was awake and saw a light in the cellar window. That's strange, right? The cellar is supposed to be empty at night.",
    ],
    suspicions: [
      "Okay so I have a theory — it's not fully formed yet. Little things, separately nothing, but together...",
      "People say things to their seamstress they wouldn't say anywhere else. I've been putting pieces together.",
    ],
    alibi: [
      "Half the village can confirm I was at Elena's gossiping all morning. Though she'll tell it differently.",
      "I was fitting a dress for the merchant's wife. She can confirm — though the fitting didn't go well.",
    ],
  },

  piotr_miller: {
    whereabouts: [
      "The mill, mostly. Came into town for supplies. I don't usually come to town much — prefer the quiet.",
      "I was running an errand for Elena, actually. Then back to the mill. Nothing to report.",
    ],
    night_activity: [
      "I sleep very soundly. The mill makes noise all night — you stop hearing it after a while.",
      "Nothing I'd want to put anyone in a difficult position over. Let's leave last night alone.",
    ],
    suspicions: [
      "I don't like to point fingers. It causes more trouble than it solves, in my experience.",
      "I'm sure there's an explanation for everything. People are good, mostly. I believe that.",
    ],
    alibi: [
      "The mill workers know my schedule better than I do. Ask them.",
      "I'd rather not drag people into this. But I wasn't alone all day.",
    ],
  },

  nadia_librarian: {
    whereabouts: [
      "The library, as always. I've been cataloguing the historical records. Someone has to maintain institutional memory.",
      "The library and a brief stop at the market. I keep a journal — precise notes on my movements, if you require them.",
    ],
    night_activity: [
      "I was in the library until late. There's a historical account of similar events in this village — possibly relevant. I'm still analyzing it.",
      "I noted three anomalies from my window. I won't speculate without more data, but I can describe what I observed if it would help.",
    ],
    suspicions: [
      "Based on available evidence, I'm forming a hypothesis — but the sample size is insufficient. What I can say is that the behavioral pattern I've observed is consistent with deception.",
      "I prefer to eliminate suspects methodically rather than speculate. What facts do you have? Let's compare notes.",
    ],
    alibi: [
      "The library sign-in register shows who visited. Several people can confirm I was there.",
      "I can provide timestamped notes. I document everything.",
    ],
  },

  viktor_farmer: {
    whereabouts: [
      "Fields in the morning. Market at midday. I don't go to church much — God knows where I am.",
      "Mira's stall, arguing about grain prices. Same as every week. She's a thief, by the way.",
    ],
    night_activity: [
      "I saw something I didn't expect to see. Someone I didn't expect to be out at that hour. Won't say who — not yet.",
      "Quiet enough. Though I heard raised voices near the tavern. Nothing unusual for the tavern, I suppose.",
    ],
    suspicions: [
      "It's not who you think. The obvious choice is never right, in my experience.",
      "Short list. Two names. Could be wrong about one. Probably not both.",
    ],
    alibi: [
      "I don't need one. If you're looking at me, you're wasting time.",
      "Ask Mira — we were arguing most of the afternoon. Ask the market.",
    ],
  },
};

// Generic fallback responses for any character/question combination not explicitly defined
const FALLBACK_RESPONSES = {
  whereabouts:    ["I was going about my usual business.", "Around the village. Nothing unusual."],
  night_activity: ["A quiet night, as far as I could tell.", "I didn't notice anything out of the ordinary."],
  suspicions:     ["I have my thoughts. But I keep them to myself for now.", "Hard to say. I'm watching, same as you."],
  alibi:          ["Others saw me about my work.", "I can account for my time. It just may take a moment to think."],
};

export function getResponsesForCharacter(characterId, questionType) {
  return (
    CHARACTER_RESPONSES[characterId]?.[questionType] ??
    FALLBACK_RESPONSES[questionType] ??
    ["..."]
  );
}

export function getRandomResponse(characterId, questionType) {
  const pool = getResponsesForCharacter(characterId, questionType);
  return pool[Math.floor(Math.random() * pool.length)];
}
