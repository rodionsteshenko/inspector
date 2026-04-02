// Poisoning mechanic: mafia coordination and proximity tracking
// Mafia must meet (coordinate) then reach target to poison them

import { getShortestPath, getMinimumMoves, getAdjacentLocations, MAP_NODES, ADJACENCY_MAP } from './map.js';
import { ROLES } from './roles.js';

function getNodes(state) { return state.mapConfig?.nodes || MAP_NODES; }
function getAdj(state) { return state.mapConfig?.adjacencyMap || ADJACENCY_MAP; }

export function getMafiaAlive(characters) {
  return characters.filter(c => c.role === ROLES.MAFIA && c.alive);
}

// Check if both mafia members are at the same location
export function isMafiaCoordinated(characters) {
  const mafia = getMafiaAlive(characters);
  if (mafia.length < 2) return false;
  return mafia[0].location === mafia[1].location;
}

// Choose a target to poison (non-mafia, alive, never the player)
// The mafia doesn't know who the inspector is — they target NPCs only.
// The only way the player dies is by voluntarily revealing themselves to a mafia member.
export function choosePoisonTarget(characters, rng = Math.random) {
  const eligible = characters.filter(c => c.alive && c.role !== ROLES.MAFIA && c.id !== 'player');
  if (eligible.length === 0) return null;
  return eligible[Math.floor(rng() * eligible.length)].id;
}

// Check if any mafia member is at the same location as the target
export function hasMafiaReachedTarget(characters, targetId) {
  if (!targetId) return false;
  const target = characters.find(c => c.id === targetId && c.alive);
  if (!target) return false;
  const mafia = getMafiaAlive(characters);
  return mafia.some(m => m.location === target.location);
}

// Get next step on path from current to target location
export function getNextStep(currentId, targetId, adjacencyMap = ADJACENCY_MAP) {
  if (!currentId || !targetId || currentId === targetId) return null;
  const path = getShortestPath(currentId, targetId, adjacencyMap);
  if (!path || path.length < 2) return null;
  return path[1];
}

// Move non-killer mafia away from killer and target (dispersal behavior)
function getDispersalMove(character, killerLocation, targetLocation, state) {
  const adj = getAdjacentLocations(character.location, getAdj(state));
  if (adj.length === 0) return null;

  const { characters } = state;
  const nodes = getNodes(state);
  const adjacencyMap = getAdj(state);

  const scored = adj.map(loc => {
    const distToKiller = getMinimumMoves(loc, killerLocation, adjacencyMap) || 0;
    const distToTarget = getMinimumMoves(loc, targetLocation, adjacencyMap) || 0;
    return { loc, score: distToKiller + distToTarget };
  });
  scored.sort((a, b) => b.score - a.score);

  // Find first adjacent node that is not at capacity
  for (const { loc } of scored) {
    const node = nodes.find(n => n.id === loc);
    if (node) {
      const occupants = characters.filter(c => c.alive && c.location === loc).length;
      if (occupants < node.capacity) {
        return loc;
      }
    }
  }

  return null; // Stay put if all adjacent nodes are full
}

// Plan the mafia's full day at day start.
// Returns a fresh mafiaState with the day's plan computed.
export function planMafiaDay(state, rng = Math.random) {
  const { characters } = state;
  const mafia = getMafiaAlive(characters);
  const nodes = getNodes(state);
  const adjacencyMap = getAdj(state);

  const emptyPlan = {
    coordinated: false,
    meetingNode: null,
    meetChunk: null,
    target: null,
    killerMafiaId: null,
    poisoned: false,
    noKill: false,
    dispersed: false,
  };

  if (mafia.length < 2) {
    // Solo mafia: hunt target directly, no meeting needed
    const target = choosePoisonTarget(characters, rng);
    return { ...emptyPlan, target, noKill: target === null };
  }

  const mafiaA = mafia[0];
  const mafiaB = mafia[1];

  const potentialTargets = characters.filter(c => c.alive && c.role !== ROLES.MAFIA);
  if (potentialTargets.length === 0) {
    return { ...emptyPlan, noKill: true };
  }

  // Try every (target, meeting_node) pair for feasibility
  const chunksPerDay = state.chunksPerDay || 8;
  const feasiblePlans = [];

  for (const target of potentialTargets) {
    for (const node of nodes) {
      const distA = getMinimumMoves(mafiaA.location, node.id, adjacencyMap);
      const distB = getMinimumMoves(mafiaB.location, node.id, adjacencyMap);
      if (distA === null || distB === null) continue;

      const meetChunk = Math.max(distA, distB) + 1;
      if (meetChunk > chunksPerDay) continue;

      const chunksAfterMeeting = chunksPerDay - meetChunk;
      const distToTarget = getMinimumMoves(node.id, target.location, adjacencyMap);
      if (distToTarget === null) continue;

      if (distToTarget <= chunksAfterMeeting) {
        feasiblePlans.push({
          targetId: target.id,
          meetingNode: node.id,
          meetChunk,
          meetingNotAtTarget: node.id !== target.location,
        });
      }
    }
  }

  if (feasiblePlans.length === 0) {
    return { ...emptyPlan, noKill: true };
  }

  // Group feasible plans by target
  const byTarget = {};
  for (const plan of feasiblePlans) {
    if (!byTarget[plan.targetId]) byTarget[plan.targetId] = [];
    byTarget[plan.targetId].push(plan);
  }

  const feasibleTargetIds = Object.keys(byTarget);
  const playerFeasible = byTarget['player'] !== undefined;
  const nonPlayerTargetIds = feasibleTargetIds.filter(id => id !== 'player');

  // Always pick a non-player target — mafia doesn't know who the inspector is
  let chosenTargetId;
  if (nonPlayerTargetIds.length > 0) {
    chosenTargetId = nonPlayerTargetIds[Math.floor(rng() * nonPlayerTargetIds.length)];
  } else {
    // No NPC targets — no kill this night
    return { ...emptyPlan, noKill: true };
  }

  // Pick best plan: earliest meetChunk, then prefer meeting node not at target location
  const targetPlans = byTarget[chosenTargetId];
  targetPlans.sort((a, b) => {
    if (a.meetChunk !== b.meetChunk) return a.meetChunk - b.meetChunk;
    if (a.meetingNotAtTarget !== b.meetingNotAtTarget) return a.meetingNotAtTarget ? -1 : 1;
    return 0;
  });

  const best = targetPlans[0];

  return {
    coordinated: false,
    meetingNode: best.meetingNode,
    meetChunk: best.meetChunk,
    target: best.targetId,
    killerMafiaId: null,
    poisoned: false,
    noKill: false,
    dispersed: false,
  };
}

// Get next move for a mafia member based on the day plan
export function getMafiaKillerNextMove(character, state, rng = Math.random) {
  const { mafiaState, characters } = state;
  const mafia = getMafiaAlive(characters);
  const adjacencyMap = getAdj(state);

  if (mafia.length === 0) return null;

  // noKill plan: move semi-randomly (citizen behavior) to avoid suspicion
  if (mafiaState && mafiaState.noKill) {
    const adj = getAdjacentLocations(character.location, adjacencyMap);
    if (adj.length === 0 || rng() > 0.45) return null;
    return adj[Math.floor(rng() * adj.length)];
  }

  // Only one mafia alive — hunt target directly
  if (mafia.length === 1) {
    if (mafiaState && mafiaState.target) {
      const target = characters.find(c => c.id === mafiaState.target && c.alive);
      if (target) return getNextStep(character.location, target.location, adjacencyMap);
    }
    return null;
  }

  if (!mafiaState) return null;

  // Already poisoned — no movement needed
  if (mafiaState.poisoned) return null;

  // Before coordination: route toward meetingNode
  if (!mafiaState.coordinated) {
    const { meetingNode } = mafiaState;

    // Backward compat: no meetingNode → move toward partner (legacy behavior)
    if (!meetingNode) {
      const partner = mafia.find(m => m.id !== character.id);
      if (partner && partner.location !== character.location) {
        return getNextStep(character.location, partner.location, adjacencyMap);
      }
      return null;
    }

    if (character.location === meetingNode) return null; // Already at meeting node, stay
    return getNextStep(character.location, meetingNode, adjacencyMap);
  }

  // After coordination
  const target = mafiaState.target
    ? characters.find(c => c.id === mafiaState.target && c.alive)
    : null;
  if (!target) return null;

  // Killer: route toward target
  if (mafiaState.killerMafiaId === character.id) {
    return getNextStep(character.location, target.location, adjacencyMap);
  }

  // Legacy fallback: no killerMafiaId set → all mafia move toward target
  if (!mafiaState.killerMafiaId) {
    return getNextStep(character.location, target.location, adjacencyMap);
  }

  // Non-killer: actively disperse away from killer and target
  const killer = characters.find(c => c.id === mafiaState.killerMafiaId && c.alive);
  const killerLocation = killer
    ? killer.location
    : (mafiaState.meetingNode || character.location);
  return getDispersalMove(character, killerLocation, target.location, state);
}

// Create fresh mafia day state (no plan — use planMafiaDay for a planned state)
export function createDayMafiaState() {
  return {
    coordinated: false,
    meetingNode: null,
    meetChunk: null,
    target: null,
    poisoned: false,
    killerMafiaId: null,
    noKill: false,
    dispersed: false,
  };
}

// Update mafia state after characters move
export function updateMafiaState(state, rng = Math.random) {
  const { characters, mafiaState } = state;
  const adjacencyMap = getAdj(state);
  let updated = mafiaState ? { ...mafiaState } : createDayMafiaState();

  // Check if mafia should coordinate
  if (!updated.coordinated && !updated.noKill) {
    const mafia = getMafiaAlive(characters);
    let shouldCoordinate = false;

    if (updated.meetingNode) {
      // New behavior: both must be at the planned meeting node
      shouldCoordinate = mafia.length >= 2 && mafia.every(m => m.location === updated.meetingNode);
    } else {
      // Legacy behavior: any shared location triggers coordination
      shouldCoordinate = isMafiaCoordinated(characters);
    }

    if (shouldCoordinate) {
      let newTarget = updated.target;
      // Legacy: choose target now if not already planned
      if (!newTarget) {
        newTarget = choosePoisonTarget(characters, rng);
      }

      // Determine killerMafiaId: whichever mafia is closer to target
      let killerMafiaId = null;
      if (newTarget && mafia.length >= 2) {
        const target = characters.find(c => c.id === newTarget && c.alive);
        if (target) {
          const distA = getMinimumMoves(mafia[0].location, target.location, adjacencyMap);
          const distB = getMinimumMoves(mafia[1].location, target.location, adjacencyMap);
          if (distA !== null && distB !== null) {
            killerMafiaId = distA <= distB ? mafia[0].id : mafia[1].id;
          }
        }
      }

      updated = { ...updated, coordinated: true, target: newTarget, killerMafiaId };
    }
  }

  // Check if killer reached the target (poisoning)
  if (updated.coordinated && updated.target && !updated.poisoned) {
    const target = characters.find(c => c.id === updated.target && c.alive);
    if (target) {
      if (updated.killerMafiaId) {
        // Check the specific killer
        const killer = characters.find(c => c.id === updated.killerMafiaId && c.alive);
        if (killer && killer.location === target.location) {
          updated = { ...updated, poisoned: true };
        }
      } else {
        // Legacy fallback: any mafia at target location
        const mafia = getMafiaAlive(characters);
        const killer = mafia.find(m => m.location === target.location);
        if (killer) {
          updated = { ...updated, poisoned: true, killerMafiaId: killer.id };
        }
      }
    }
  }

  return updated;
}

// After a death, flag characters who shared a location with victim on that day
export function flagProximityAfterDeath(evidenceBoard, characters, victimId, day) {
  const movementLogs = evidenceBoard.movementLogs || [];

  // Find all logs for the victim on that day
  const victimLogs = movementLogs.filter(l => l.characterId === victimId && l.day === day);

  const seen = new Set();
  const proximityFlags = [];

  for (const vLog of victimLogs) {
    const coLocated = movementLogs.filter(l =>
      l.day === vLog.day &&
      l.chunk === vLog.chunk &&
      l.location === vLog.location &&
      l.characterId !== victimId
    );
    for (const other of coLocated) {
      if (!seen.has(other.characterId)) {
        seen.add(other.characterId);
        proximityFlags.push({
          characterId: other.characterId,
          victimId,
          day,
          chunk: vLog.chunk,
          location: vLog.location,
        });
      }
    }
  }

  if (proximityFlags.length === 0) return evidenceBoard;

  return {
    ...evidenceBoard,
    proximityFlags: [...(evidenceBoard.proximityFlags || []), ...proximityFlags],
  };
}
