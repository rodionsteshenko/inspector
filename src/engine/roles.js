// Role definitions and random assignment

export const ROLES = {
  INSPECTOR: 'inspector',
  MAFIA: 'mafia',
  DOCTOR: 'doctor',
  JOURNALIST: 'journalist',
  MASON: 'mason',
  CITIZEN: 'citizen',
};

export const TEAMS = {
  INNOCENTS: 'innocents',
  MAFIA: 'mafia',
};

export const ROLE_CONFIG = {
  [ROLES.INSPECTOR]: { team: TEAMS.INNOCENTS, isPlayer: true, description: 'Investigate one person per night. Learn their exact role.' },
  [ROLES.MAFIA]: { team: TEAMS.MAFIA, isPlayer: false, description: 'Coordinate secretly. Each night, pick one person to kill.' },
  [ROLES.DOCTOR]: { team: TEAMS.INNOCENTS, isPlayer: false, description: 'Each night, protect one person from being killed.' },
  [ROLES.JOURNALIST]: { team: TEAMS.INNOCENTS, isPlayer: false, description: 'Ally grants inspector +1 conversation slot per day.' },
  [ROLES.MASON]: { team: TEAMS.INNOCENTS, isPlayer: false, description: 'Knows one confirmed innocent at game start.' },
  [ROLES.CITIZEN]: { team: TEAMS.INNOCENTS, isPlayer: false, description: 'No special ability. Pure social deduction.' },
};

// NPC role pool: 2 mafia, 1 doctor, 1 journalist, 1 mason, 6 citizens = 11 roles
export const NPC_ROLE_POOL = [
  ROLES.MAFIA,
  ROLES.MAFIA,
  ROLES.DOCTOR,
  ROLES.JOURNALIST,
  ROLES.MASON,
  ROLES.CITIZEN,
  ROLES.CITIZEN,
  ROLES.CITIZEN,
  ROLES.CITIZEN,
  ROLES.CITIZEN,
  ROLES.CITIZEN,
];

// Role pools for different player counts (NPC count = players - 1)
export const PLAYER_COUNT_CONFIGS = {
  6: {
    npcCount: 5,
    rolePool: [ROLES.MAFIA, ROLES.MAFIA, ROLES.DOCTOR, ROLES.CITIZEN, ROLES.CITIZEN],
  },
  8: {
    npcCount: 7,
    rolePool: [ROLES.MAFIA, ROLES.MAFIA, ROLES.DOCTOR, ROLES.MASON, ROLES.JOURNALIST, ROLES.CITIZEN, ROLES.CITIZEN],
  },
  10: {
    npcCount: 9,
    rolePool: [ROLES.MAFIA, ROLES.MAFIA, ROLES.DOCTOR, ROLES.MASON, ROLES.JOURNALIST, ROLES.CITIZEN, ROLES.CITIZEN, ROLES.CITIZEN, ROLES.CITIZEN],
  },
  12: {
    npcCount: 11,
    rolePool: [...NPC_ROLE_POOL],
  },
};

// Role descriptions for setup screen cards
export const ROLE_DESCRIPTIONS = {
  [ROLES.INSPECTOR]: 'Investigate one person per night. Learn their exact role.',
  [ROLES.MAFIA]: 'Coordinate secretly. Each night, pick someone to kill.',
  [ROLES.DOCTOR]: 'Each night, protect one person from being killed.',
  [ROLES.JOURNALIST]: 'Your ally gains +1 conversation slot per day.',
  [ROLES.MASON]: 'Know one confirmed innocent at game start.',
  [ROLES.CITIZEN]: 'No special ability. Pure social deduction.',
};

// Assign roles to exactly N NPC character IDs using provided role pool
export function assignRolesFromPool(npcIds, rolePool, rng = Math.random) {
  if (npcIds.length !== rolePool.length) {
    throw new Error(`assignRolesFromPool: ${npcIds.length} IDs but ${rolePool.length} roles`);
  }
  const pool = shuffle(rolePool, rng);
  const assignments = {};
  for (let i = 0; i < npcIds.length; i++) {
    assignments[npcIds[i]] = pool[i];
  }
  return assignments;
}

export function isInnocent(role) {
  return ROLE_CONFIG[role]?.team === TEAMS.INNOCENTS;
}

export function isMafia(role) {
  return ROLE_CONFIG[role]?.team === TEAMS.MAFIA;
}

export function getRoleTeam(role) {
  return ROLE_CONFIG[role]?.team ?? null;
}

// Fisher-Yates shuffle (pure function, accepts optional seeded rng)
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assign roles to NPC character IDs (expects exactly NPC_ROLE_POOL.length IDs)
// Returns { [characterId]: role }
export function assignRoles(npcIds, rng = Math.random) {
  if (npcIds.length !== NPC_ROLE_POOL.length) {
    throw new Error(`assignRoles expects exactly ${NPC_ROLE_POOL.length} NPC IDs, got ${npcIds.length}`);
  }
  const pool = shuffle(NPC_ROLE_POOL, rng);
  const assignments = {};
  for (let i = 0; i < npcIds.length; i++) {
    assignments[npcIds[i]] = pool[i];
  }
  return assignments;
}

export function validateRoleDistribution(assignments) {
  const counts = {};
  for (const role of Object.values(assignments)) {
    counts[role] = (counts[role] || 0) + 1;
  }
  const errors = [];
  if (counts[ROLES.MAFIA] !== 2) errors.push(`Expected 2 mafia, got ${counts[ROLES.MAFIA]}`);
  if (counts[ROLES.DOCTOR] !== 1) errors.push(`Expected 1 doctor, got ${counts[ROLES.DOCTOR]}`);
  if (counts[ROLES.JOURNALIST] !== 1) errors.push(`Expected 1 journalist, got ${counts[ROLES.JOURNALIST]}`);
  if (counts[ROLES.MASON] !== 1) errors.push(`Expected 1 mason, got ${counts[ROLES.MASON]}`);
  if (counts[ROLES.CITIZEN] !== 6) errors.push(`Expected 6 citizens, got ${counts[ROLES.CITIZEN]}`);
  return errors;
}
