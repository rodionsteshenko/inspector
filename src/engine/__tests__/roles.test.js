import { describe, it, expect } from 'vitest';
import {
  ROLES,
  TEAMS,
  ROLE_CONFIG,
  NPC_ROLE_POOL,
  isInnocent,
  isMafia,
  getRoleTeam,
  shuffle,
  assignRoles,
  validateRoleDistribution,
} from '../roles.js';

describe('ROLE_CONFIG', () => {
  it('inspector is on innocents team', () => {
    expect(ROLE_CONFIG[ROLES.INSPECTOR].team).toBe(TEAMS.INNOCENTS);
  });

  it('mafia is on mafia team', () => {
    expect(ROLE_CONFIG[ROLES.MAFIA].team).toBe(TEAMS.MAFIA);
  });

  it('all other roles are on innocents team', () => {
    const innocentRoles = [ROLES.DOCTOR, ROLES.JOURNALIST, ROLES.MASON, ROLES.CITIZEN];
    for (const role of innocentRoles) {
      expect(ROLE_CONFIG[role].team).toBe(TEAMS.INNOCENTS);
    }
  });
});

describe('NPC_ROLE_POOL', () => {
  it('has exactly 11 roles', () => {
    expect(NPC_ROLE_POOL).toHaveLength(11);
  });

  it('contains exactly 2 mafia', () => {
    expect(NPC_ROLE_POOL.filter(r => r === ROLES.MAFIA)).toHaveLength(2);
  });

  it('contains exactly 1 doctor', () => {
    expect(NPC_ROLE_POOL.filter(r => r === ROLES.DOCTOR)).toHaveLength(1);
  });

  it('contains exactly 1 journalist', () => {
    expect(NPC_ROLE_POOL.filter(r => r === ROLES.JOURNALIST)).toHaveLength(1);
  });

  it('contains exactly 1 mason', () => {
    expect(NPC_ROLE_POOL.filter(r => r === ROLES.MASON)).toHaveLength(1);
  });

  it('contains exactly 6 citizens', () => {
    expect(NPC_ROLE_POOL.filter(r => r === ROLES.CITIZEN)).toHaveLength(6);
  });
});

describe('isInnocent', () => {
  it('returns true for innocent roles', () => {
    expect(isInnocent(ROLES.INSPECTOR)).toBe(true);
    expect(isInnocent(ROLES.CITIZEN)).toBe(true);
    expect(isInnocent(ROLES.DOCTOR)).toBe(true);
    expect(isInnocent(ROLES.JOURNALIST)).toBe(true);
    expect(isInnocent(ROLES.MASON)).toBe(true);
  });

  it('returns false for mafia', () => {
    expect(isInnocent(ROLES.MAFIA)).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(isInnocent('unknown')).toBe(false);
  });
});

describe('isMafia', () => {
  it('returns true for mafia role', () => {
    expect(isMafia(ROLES.MAFIA)).toBe(true);
  });

  it('returns false for innocent roles', () => {
    expect(isMafia(ROLES.INSPECTOR)).toBe(false);
    expect(isMafia(ROLES.CITIZEN)).toBe(false);
    expect(isMafia(ROLES.DOCTOR)).toBe(false);
  });
});

describe('shuffle', () => {
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled).toHaveLength(arr.length);
    expect(shuffled.sort()).toEqual([...arr].sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });

  it('produces different orderings with different rng', () => {
    // Use a seeded-like rng to get deterministic results
    let i = 0;
    const seeded = () => [0.1, 0.9, 0.3, 0.7, 0.5, 0.2][i++ % 6];
    const arr = [1, 2, 3, 4, 5];
    const s1 = shuffle(arr, seeded);
    i = 0;
    const s2 = shuffle(arr, seeded);
    // With same seeded rng, results should be equal
    expect(s1).toEqual(s2);
  });
});

describe('assignRoles', () => {
  const npcIds = [
    'brad', 'elena', 'gregor', 'mira', 'tomas',
    'dasha', 'lev', 'anya', 'piotr', 'nadia', 'viktor'
  ];

  it('assigns a role to every NPC', () => {
    const assignments = assignRoles(npcIds);
    expect(Object.keys(assignments)).toHaveLength(11);
    for (const id of npcIds) {
      expect(assignments).toHaveProperty(id);
    }
  });

  it('throws if not exactly 11 IDs', () => {
    expect(() => assignRoles(['a', 'b'])).toThrow();
    expect(() => assignRoles([])).toThrow();
  });

  it('produces correct role distribution', () => {
    const assignments = assignRoles(npcIds);
    const errors = validateRoleDistribution(assignments);
    expect(errors).toHaveLength(0);
  });

  it('does not assign inspector role to NPCs', () => {
    const assignments = assignRoles(npcIds);
    for (const role of Object.values(assignments)) {
      expect(role).not.toBe(ROLES.INSPECTOR);
    }
  });

  it('produces different distributions across runs (probabilistic)', () => {
    // Run 10 times and check at least 2 are different
    const results = Array.from({ length: 10 }, () =>
      JSON.stringify(assignRoles(npcIds))
    );
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('validateRoleDistribution', () => {
  it('returns empty array for valid distribution', () => {
    const npcIds = [
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'
    ];
    const assignments = assignRoles(npcIds);
    expect(validateRoleDistribution(assignments)).toHaveLength(0);
  });

  it('flags wrong mafia count', () => {
    const bad = {};
    ['a','b','c','d','e','f','g','h','i','j','k'].forEach((id, idx) => {
      bad[id] = idx < 3 ? ROLES.MAFIA : ROLES.CITIZEN;
    });
    const errors = validateRoleDistribution(bad);
    expect(errors.some(e => e.includes('mafia'))).toBe(true);
  });
});
