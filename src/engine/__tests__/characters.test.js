import { describe, it, expect } from 'vitest';
import {
  NPC_DEFINITIONS,
  PLAYER_CHARACTER,
  createCharacter,
  createPlayer,
  getCharacterById,
  getAliveCharacters,
  getCharactersAtLocation,
  getNPCIds,
  getMafiaIds,
  getInnocentIds,
  addCharacterObservation,
  addHeardFrom,
} from '../characters.js';

describe('NPC_DEFINITIONS', () => {
  it('has 25 NPC definitions', () => {
    expect(NPC_DEFINITIONS).toHaveLength(25);
  });

  it('each NPC has required fields', () => {
    for (const npc of NPC_DEFINITIONS) {
      expect(npc).toHaveProperty('id');
      expect(npc).toHaveProperty('name');
      expect(npc).toHaveProperty('personality');
    }
  });

  it('all NPC IDs are unique', () => {
    const ids = NPC_DEFINITIONS.map(n => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('createCharacter', () => {
  it('creates a character with the correct structure', () => {
    const char = createCharacter(NPC_DEFINITIONS[0], 'citizen', 'town_square');
    expect(char.id).toBe(NPC_DEFINITIONS[0].id);
    expect(char.name).toBe(NPC_DEFINITIONS[0].name);
    expect(char.role).toBe('citizen');
    expect(char.location).toBe('town_square');
    expect(char.alive).toBe(true);
    expect(char.movementLog).toHaveLength(1);
    expect(char.movementLog[0].location).toBe('town_square');
    expect(char.conversationLog).toEqual([]);
    expect(char.knowledgeState.witnessed).toEqual([]);
    expect(char.knowledgeState.heardFrom).toEqual([]);
    expect(char.verifiedByInspector).toBe(false);
    expect(char.alliedWithInspector).toBe(false);
  });
});

describe('createPlayer', () => {
  it('creates player with inspector role', () => {
    const player = createPlayer('tavern');
    expect(player.id).toBe('player');
    expect(player.role).toBe('inspector');
    expect(player.location).toBe('tavern');
    expect(player.alive).toBe(true);
    expect(player.isPlayer).toBe(true);
  });
});

describe('getCharacterById', () => {
  const chars = [
    createCharacter(NPC_DEFINITIONS[0], 'citizen', 'town_square'),
    createCharacter(NPC_DEFINITIONS[1], 'mafia', 'tavern'),
    createPlayer('docks'),
  ];

  it('finds character by ID', () => {
    const found = getCharacterById(chars, 'player');
    expect(found).not.toBeNull();
    expect(found.id).toBe('player');
  });

  it('returns null for unknown ID', () => {
    expect(getCharacterById(chars, 'nobody')).toBeNull();
  });
});

describe('getAliveCharacters', () => {
  it('only returns alive characters', () => {
    const chars = [
      { id: 'a', alive: true },
      { id: 'b', alive: false },
      { id: 'c', alive: true },
    ];
    const alive = getAliveCharacters(chars);
    expect(alive).toHaveLength(2);
    expect(alive.map(c => c.id)).toEqual(['a', 'c']);
  });
});

describe('getCharactersAtLocation', () => {
  const chars = [
    { id: 'a', alive: true, location: 'tavern' },
    { id: 'b', alive: true, location: 'church' },
    { id: 'c', alive: false, location: 'tavern' },
    { id: 'd', alive: true, location: 'tavern' },
  ];

  it('returns alive characters at given location', () => {
    const atTavern = getCharactersAtLocation(chars, 'tavern');
    expect(atTavern).toHaveLength(2);
    expect(atTavern.map(c => c.id)).toContain('a');
    expect(atTavern.map(c => c.id)).toContain('d');
    expect(atTavern.map(c => c.id)).not.toContain('c'); // dead
  });
});

describe('getNPCIds', () => {
  it('returns 11 NPC IDs', () => {
    expect(getNPCIds()).toHaveLength(25);
  });
});

describe('getMafiaIds', () => {
  it('returns only alive mafia IDs', () => {
    const chars = [
      { id: 'a', role: 'mafia', alive: true },
      { id: 'b', role: 'mafia', alive: false },
      { id: 'c', role: 'citizen', alive: true },
    ];
    expect(getMafiaIds(chars)).toEqual(['a']);
  });
});

describe('getInnocentIds', () => {
  it('returns alive non-mafia IDs', () => {
    const chars = [
      { id: 'a', role: 'mafia', alive: true },
      { id: 'b', role: 'citizen', alive: true },
      { id: 'c', role: 'doctor', alive: false },
      { id: 'd', role: 'citizen', alive: true },
    ];
    const innocents = getInnocentIds(chars);
    expect(innocents).toContain('b');
    expect(innocents).toContain('d');
    expect(innocents).not.toContain('a'); // mafia
    expect(innocents).not.toContain('c'); // dead
  });
});

describe('addCharacterObservation', () => {
  it('adds observation immutably', () => {
    const char = createCharacter(NPC_DEFINITIONS[0], 'citizen', 'tavern');
    const obs = { type: 'saw_meeting', location: 'tavern', day: 1, chunk: 2 };
    const updated = addCharacterObservation(char, obs);
    expect(updated.knowledgeState.witnessed).toHaveLength(1);
    expect(char.knowledgeState.witnessed).toHaveLength(0); // original unchanged
  });
});

describe('addHeardFrom', () => {
  it('adds heardFrom info immutably', () => {
    const char = createCharacter(NPC_DEFINITIONS[0], 'citizen', 'tavern');
    const info = { source: 'brad', content: 'Viktor was at docks' };
    const updated = addHeardFrom(char, info);
    expect(updated.knowledgeState.heardFrom).toHaveLength(1);
    expect(char.knowledgeState.heardFrom).toHaveLength(0);
  });
});
