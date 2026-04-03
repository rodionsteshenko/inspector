// Character data, movement log, knowledge state

// Full A-Z village cast — game picks a random subset each run
export const NPC_DEFINITIONS = [
  { id: 'aleksei_apothecary',  name: 'Aleksei the Apothecary',  gender: 'm', personality: 'cautious and analytical, measures every word like a dosage' },
  { id: 'boris_barber',        name: 'Boris the Barber',        gender: 'm', personality: 'chatty, knows everyone\'s business, talks too much' },
  { id: 'crina_cartwright',    name: 'Crina the Cartwright',    gender: 'f', personality: 'practical and blunt, judges people by their hands and their work' },
  { id: 'dmitri_dockworker',   name: 'Dmitri the Dockworker',   gender: 'm', personality: 'quiet, says little, sees more than people think' },
  { id: 'elena_embroideress',  name: 'Elena the Embroideress',  gender: 'f', personality: 'patient and observant, notices small details others miss' },
  { id: 'fyodor_fisherman',    name: 'Fyodor the Fisherman',    gender: 'm', personality: 'blunt, says exactly what he thinks, sometimes wrong' },
  { id: 'gregor_gravedigger',  name: 'Gregor the Gravedigger',  gender: 'm', personality: 'moralistic, suspects everyone, quotes scripture when nervous' },
  { id: 'hana_herbalist',      name: 'Hana the Herbalist',      gender: 'f', personality: 'gentle and wise, slow to speak but her words carry weight' },
  { id: 'igor_innkeeper',      name: 'Igor the Innkeeper',      gender: 'm', personality: 'warm but strategic, trusts slowly, notices everything' },
  { id: 'jana_jeweler',        name: 'Jana the Jeweler',        gender: 'f', personality: 'sharp and discerning, values precision, dislikes ambiguity' },
  { id: 'katya_knitter',       name: 'Katya the Knitter',       gender: 'f', personality: 'warm and motherly, wants to believe the best, sometimes naive' },
  { id: 'lev_lamplighter',     name: 'Lev the Lamplighter',     gender: 'm', personality: 'analytical, collects facts, slow to commit to a theory' },
  { id: 'mila_merchant',       name: 'Mila the Merchant',       gender: 'f', personality: 'calculating, trades information like goods' },
  { id: 'nikolai_notary',      name: 'Nikolai the Notary',      gender: 'm', personality: 'precise and formal, hides behind procedure, dislikes confrontation' },
  { id: 'oksana_ostler',       name: 'Oksana the Ostler',       gender: 'f', personality: 'sturdy and no-nonsense, has little patience for gossip or games' },
  { id: 'pavel_potter',        name: 'Pavel the Potter',        gender: 'm', personality: 'cheerful and disarming, uses humor to deflect serious questions' },
  { id: 'sofia_seamstress',    name: 'Sofia the Seamstress',    gender: 'f', personality: 'gossipy, shares too much, hard to know what\'s true' },
  { id: 'tomas_tailor',        name: 'Tomas the Tailor',        gender: 'm', personality: 'paranoid, jumps to conclusions, rarely wrong' },
  { id: 'ursula_undertaker',   name: 'Ursula the Undertaker',   gender: 'f', personality: 'composed and unsettling, speaks of death with unsettling calm' },
  { id: 'vera_vintner',        name: 'Vera the Vintner',        gender: 'f', personality: 'protective, deflects questions, focuses on others\' safety' },
  { id: 'wanda_weaver',        name: 'Wanda the Weaver',        gender: 'f', personality: 'industrious and proud, resents being interrupted, watches people while she works' },
  { id: 'xavier_xylophonist',  name: 'Xavier the Xylophonist',  gender: 'm', personality: 'charming outsider, arrived the day before the murder, nervous beneath the smile' },
  { id: 'yana_yarn_spinner',   name: 'Yana the Yarn-Spinner',   gender: 'f', personality: 'quietly observant, listens far more than she speaks' },
  { id: 'marek_miller',        name: 'Marek the Miller',        gender: 'm', personality: 'conflict-averse, smooths things over, hates accusation' },
  { id: 'zora_zinker',         name: 'Zora the Zinker',         gender: 'f', personality: 'deeply religious, sees signs and omens in everything, believes in fate' },
];

// Role-based motivation strings injected into NPC system prompts.
// These shape how they behave during the day — movement priorities, conversational strategy.
export const ROLE_MOTIVATIONS = {
  mafia: `You are secretly one of two mafia members responsible for the killing. Your goal is survival and deflection.
- You met with your partner at some point today. After that meeting, behave normally — do not avoid them obviously, but do not cluster with them either.
- Seem cooperative and helpful. Express concern about the murder. Deflect suspicion toward others subtly.
- Never admit to knowing who the killer is. If pressed, redirect with a question or point elsewhere.
- Do not panic. Do not over-explain. A guilty person who over-talks is a caught person.`,

  citizen: `You are an innocent villager. You are frightened. Someone you knew was killed and the killer is still among you.
- You want the murderer found, but you are also afraid of being falsely accused.
- Share what you know honestly — but only what you personally witnessed or heard directly.
- You may have suspicions. Voice them naturally if asked, but do not accuse wildly.`,

  doctor: `You are an innocent villager with a quiet protective instinct.
- You pay close attention to who seems most at risk each day.
- You do not announce your role or your intentions to anyone.
- You are watchful, careful, and tend to stay near people you think are in danger.
- If asked where you were, you tell the truth — but you may be vague about why you were there.`,

  journalist: `You are an innocent villager with a sharp eye for detail.
- You notice things others don't — who came in late, who left early, who avoided eye contact.
- You are drawn to information and ask questions yourself, not just answer them.
- You are willing to share what you know, but you want something in return — trust or reciprocity.`,

  mason: `You are an innocent villager who belongs to a quiet fraternal order in the village.
- You know one other person in the village is also innocent (your fellow mason), though you do not name them openly.
- You are community-minded and cooperative, and you are certain of your own innocence.
- You may hint at having "trustworthy friends" without revealing the order.`,
};

export const PLAYER_CHARACTER = {
  id: 'player',
  name: 'Rodion the Registrar',
  personality: 'methodical investigator',
  isPlayer: true,
};

export function createCharacter(definition, role, startLocation) {
  return {
    id: definition.id,
    name: definition.name,
    personality: definition.personality,
    gender: definition.gender || 'm',
    isPlayer: definition.isPlayer || false,
    role,
    location: startLocation,
    alive: true,
    movementLog: [{ day: 1, chunk: 0, location: startLocation }],
    conversationLog: [],
    knowledgeState: {
      witnessed: [],
      heardFrom: [],
    },
    suspicions: [],
    verifiedByInspector: false,
    alliedWithInspector: false,
  };
}

export function createPlayer(startLocation) {
  return createCharacter(PLAYER_CHARACTER, 'inspector', startLocation);
}

// Distribute characters across starting locations
// Returns { [characterId]: locationId }
export function distributeStartingLocations(characterIds, nodes, rng = Math.random) {
  const locations = nodes.map(n => n.id);
  const assignments = {};
  for (const id of characterIds) {
    const loc = locations[Math.floor(rng() * locations.length)];
    assignments[id] = loc;
  }
  return assignments;
}

export function getCharacterById(characters, id) {
  return characters.find(c => c.id === id) || null;
}

export function getAliveCharacters(characters) {
  return characters.filter(c => c.alive);
}

export function getCharactersAtLocation(characters, locationId) {
  return characters.filter(c => c.alive && c.location === locationId);
}

export function getNPCIds() {
  return NPC_DEFINITIONS.map(d => d.id);
}

export function getMafiaIds(characters) {
  return characters.filter(c => c.role === 'mafia' && c.alive).map(c => c.id);
}

export function getInnocentIds(characters) {
  return characters.filter(c => c.role !== 'mafia' && c.alive).map(c => c.id);
}

export function addCharacterObservation(character, observation) {
  return {
    ...character,
    knowledgeState: {
      ...character.knowledgeState,
      witnessed: [...character.knowledgeState.witnessed, observation],
    },
  };
}

export function addHeardFrom(character, info) {
  return {
    ...character,
    knowledgeState: {
      ...character.knowledgeState,
      heardFrom: [...character.knowledgeState.heardFrom, info],
    },
  };
}
