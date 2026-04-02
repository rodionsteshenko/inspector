// Character data, movement log, knowledge state

export const NPC_DEFINITIONS = [
  { id: 'brad_barber', name: 'Boris the Barber', personality: 'chatty, knows everyone\'s business, talks too much' },
  { id: 'elena_innkeeper', name: 'Igor the Innkeeper', personality: 'warm but strategic, trusts slowly, notices everything' },
  { id: 'father_gregor', name: 'Gregor the Gravedigger', personality: 'moralistic, suspects everyone, quotes scripture when nervous' },
  { id: 'mira_merchant', name: 'Mila the Merchant', personality: 'calculating, trades information like goods' },
  { id: 'old_tomas', name: 'Tomas the Tailor', personality: 'paranoid, jumps to conclusions, rarely wrong' },
  { id: 'dasha_healer', name: 'Vera the Vintner', personality: 'protective, deflects questions, focuses on others\' safety' },
  { id: 'lev_dockworker', name: 'Dmitri the Dockworker', personality: 'quiet, says little, sees more than people think' },
  { id: 'anya_seamstress', name: 'Sofia the Seamstress', personality: 'gossipy, shares too much, hard to know what\'s true' },
  { id: 'piotr_miller', name: 'Marek the Miller', personality: 'conflict-averse, smooths things over, hates accusation' },
  { id: 'nadia_librarian', name: 'Lev the Lamplighter', personality: 'analytical, collects facts, slow to commit to a theory' },
  { id: 'viktor_farmer', name: 'Fyodor the Fisherman', personality: 'blunt, says exactly what he thinks, sometimes wrong' },
];

export const PLAYER_CHARACTER = {
  id: 'player',
  name: 'Constantine the Constable',
  personality: 'methodical investigator',
  isPlayer: true,
};

export function createCharacter(definition, role, startLocation) {
  return {
    id: definition.id,
    name: definition.name,
    personality: definition.personality,
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
