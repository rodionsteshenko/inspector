// Night resolution: kill, protect, investigate

import { ROLES, isMafia, isInnocent } from './roles.js';
import { flagProximityAfterDeath } from './poisoning.js';

export const RESOLUTION_TYPES = {
  KILLED: 'killed',
  SAVED: 'saved',
  NO_KILL: 'no_kill',
};

export function resolveNightKill(mafiaTarget, doctorTarget) {
  if (!mafiaTarget) {
    return { type: RESOLUTION_TYPES.NO_KILL, victim: null, saved: false };
  }
  if (mafiaTarget === doctorTarget) {
    return { type: RESOLUTION_TYPES.SAVED, victim: mafiaTarget, saved: true };
  }
  return { type: RESOLUTION_TYPES.KILLED, victim: mafiaTarget, saved: false };
}

export function resolveInspectorInvestigation(characters, targetId) {
  const target = characters.find(c => c.id === targetId);
  if (!target) return null;
  return {
    targetId,
    targetName: target.name,
    role: target.role,
    team: isMafia(target.role) ? 'mafia' : 'innocents',
    isInnocent: isInnocent(target.role),
    isMafia: isMafia(target.role),
  };
}

// Full night resolution: takes the state, returns updated state + result summary
export function resolveNight(state) {
  const { nightActions, characters } = state;
  const { mafiaTarget, doctorTarget, inspectorTarget, playerEliminate } = nightActions || {};

  // Resolve mafia kill
  const killResult = resolveNightKill(mafiaTarget, doctorTarget);

  // Resolve investigation
  const investigationResult = inspectorTarget
    ? resolveInspectorInvestigation(characters, inspectorTarget)
    : null;

  // Resolve player eliminate
  let eliminateResult = null;
  if (playerEliminate) {
    const target = characters.find(c => c.id === playerEliminate);
    if (target && target.alive && target.id !== 'player') {
      eliminateResult = {
        targetId: playerEliminate,
        targetName: target.name,
        role: target.role,
      };
    }
  }

  // Apply mafia kill to characters
  let updatedCharacters = characters.map(c => {
    if (killResult.type === RESOLUTION_TYPES.KILLED && c.id === killResult.victim) {
      return { ...c, alive: false };
    }
    return c;
  });

  // Apply player eliminate
  if (eliminateResult) {
    updatedCharacters = updatedCharacters.map(c => {
      if (c.id === playerEliminate) return { ...c, alive: false };
      return c;
    });
  }

  // Update player's verified status if investigation happened
  if (investigationResult) {
    updatedCharacters = updatedCharacters.map(c => {
      if (c.id === inspectorTarget) {
        return { ...c, verifiedByInspector: true };
      }
      return c;
    });
  }

  // Update confirmed roles on evidence board
  let updatedEvidenceBoard = { ...state.evidenceBoard };
  if (investigationResult) {
    updatedEvidenceBoard = {
      ...updatedEvidenceBoard,
      confirmedRoles: {
        ...updatedEvidenceBoard.confirmedRoles,
        [inspectorTarget]: investigationResult.role,
      },
    };
  }

  // Log player eliminate death
  if (eliminateResult) {
    updatedEvidenceBoard = {
      ...updatedEvidenceBoard,
      deathLog: [
        ...updatedEvidenceBoard.deathLog,
        {
          characterId: eliminateResult.targetId,
          characterName: eliminateResult.targetName,
          day: state.day,
          location: characters.find(c => c.id === eliminateResult.targetId)?.location,
          cause: 'player_eliminate',
          revealedRole: eliminateResult.role,
        },
      ],
      confirmedRoles: {
        ...updatedEvidenceBoard.confirmedRoles,
        [eliminateResult.targetId]: eliminateResult.role,
      },
    };
  }

  // Log mafia kill death and flag proximity
  if (killResult.type === RESOLUTION_TYPES.KILLED && killResult.victim) {
    const victim = characters.find(c => c.id === killResult.victim);
    updatedEvidenceBoard = {
      ...updatedEvidenceBoard,
      deathLog: [
        ...updatedEvidenceBoard.deathLog,
        {
          characterId: killResult.victim,
          characterName: victim?.name,
          day: state.day,
          location: victim?.location,
          cause: 'mafia_kill',
        },
      ],
    };
    // Flag who was near victim on the day they were poisoned (proximity evidence)
    updatedEvidenceBoard = flagProximityAfterDeath(
      updatedEvidenceBoard, characters, killResult.victim, state.day
    );
  }

  const nightResult = {
    killResult,
    investigationResult,
    eliminateResult,
    day: state.day,
  };

  // Check if player was killed
  const playerKilled = killResult.type === RESOLUTION_TYPES.KILLED && killResult.victim === 'player';

  return {
    ...state,
    characters: updatedCharacters,
    evidenceBoard: updatedEvidenceBoard,
    lastNightResult: nightResult,
    investigationsUsed: inspectorTarget ? state.investigationsUsed + 1 : state.investigationsUsed,
    phase: 'dawn',
    playerKilledThisNight: playerKilled,
  };
}

// NPC doctor logic: pick someone to protect (simplified — prefers inspector or known innocents)
export function doctorChooseTarget(state) {
  const doctor = state.characters.find(c => c.role === ROLES.DOCTOR && c.alive);
  if (!doctor) return null;

  const aliveCharacters = state.characters.filter(c => c.alive && c.id !== doctor.id);
  if (aliveCharacters.length === 0) return null;

  // Prefer protecting the player if doctor knows who inspector is
  const player = state.characters.find(c => c.id === 'player' && c.alive);
  if (player && doctor.alliedWithInspector) return player.id;

  // Otherwise random target from alive characters
  const idx = Math.floor(Math.random() * aliveCharacters.length);
  return aliveCharacters[idx].id;
}

// NPC mafia logic: pick someone to kill
// Uses poisoning mechanic if mafiaState is present, otherwise falls back to random
export function mafiaChooseTarget(state) {
  const mafiaMembers = state.characters.filter(c => c.role === ROLES.MAFIA && c.alive);
  if (mafiaMembers.length === 0) return null;

  const eligibleTargets = state.characters.filter(c => c.alive && c.role !== ROLES.MAFIA);
  if (eligibleTargets.length === 0) return null;

  // If mafia knows who the inspector is (e.g. via failed alliance), target the player directly
  if (state.mafiaKnowsInspector) {
    const player = state.characters.find(c => c.id === 'player' && c.alive);
    if (player) return 'player';
  }

  // Use poisoning mechanic when mafiaState is tracked
  if (state.mafiaState) {
    if (state.mafiaState.poisoned && state.mafiaState.target) {
      // Confirm target is still alive
      const target = state.characters.find(c => c.id === state.mafiaState.target && c.alive);
      if (target) return target.id;
    }
    // Mafia didn't poison anyone — no kill this night
    return null;
  }

  // Legacy fallback: random target (for backward compatibility with tests)
  const idx = Math.floor(Math.random() * eligibleTargets.length);
  return eligibleTargets[idx].id;
}
