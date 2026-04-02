import { describe, it, expect } from 'vitest';
import {
  resolveNightKill,
  resolveInspectorInvestigation,
  resolveNight,
  RESOLUTION_TYPES,
} from '../nightResolution.js';
import { createInitialGameState, PHASES, setNightAction } from '../gameState.js';

describe('resolveNightKill', () => {
  it('returns KILLED when mafia targets someone unprotected', () => {
    const result = resolveNightKill('brad_barber', null);
    expect(result.type).toBe(RESOLUTION_TYPES.KILLED);
    expect(result.victim).toBe('brad_barber');
    expect(result.saved).toBe(false);
  });

  it('returns SAVED when doctor protects the mafia target', () => {
    const result = resolveNightKill('brad_barber', 'brad_barber');
    expect(result.type).toBe(RESOLUTION_TYPES.SAVED);
    expect(result.victim).toBe('brad_barber');
    expect(result.saved).toBe(true);
  });

  it('returns KILLED when doctor protects wrong person', () => {
    const result = resolveNightKill('brad_barber', 'elena_innkeeper');
    expect(result.type).toBe(RESOLUTION_TYPES.KILLED);
    expect(result.victim).toBe('brad_barber');
    expect(result.saved).toBe(false);
  });

  it('returns NO_KILL when no mafia target', () => {
    const result = resolveNightKill(null, 'brad_barber');
    expect(result.type).toBe(RESOLUTION_TYPES.NO_KILL);
    expect(result.victim).toBeNull();
  });
});

describe('resolveInspectorInvestigation', () => {
  it('returns role info for a valid target', () => {
    const state = createInitialGameState();
    const npc = state.characters.find(c => c.id !== 'player');
    const result = resolveInspectorInvestigation(state.characters, npc.id);
    expect(result).not.toBeNull();
    expect(result.targetId).toBe(npc.id);
    expect(result.role).toBe(npc.role);
    expect(typeof result.isInnocent).toBe('boolean');
    expect(typeof result.isMafia).toBe('boolean');
  });

  it('correctly identifies mafia character', () => {
    const state = createInitialGameState();
    const mafioso = state.characters.find(c => c.role === 'mafia');
    const result = resolveInspectorInvestigation(state.characters, mafioso.id);
    expect(result.isMafia).toBe(true);
    expect(result.isInnocent).toBe(false);
    expect(result.team).toBe('mafia');
  });

  it('correctly identifies innocent character', () => {
    const state = createInitialGameState();
    const citizen = state.characters.find(c => c.role === 'citizen');
    const result = resolveInspectorInvestigation(state.characters, citizen.id);
    expect(result.isInnocent).toBe(true);
    expect(result.isMafia).toBe(false);
    expect(result.team).toBe('innocents');
  });

  it('returns null for unknown target', () => {
    const state = createInitialGameState();
    const result = resolveInspectorInvestigation(state.characters, 'nobody');
    expect(result).toBeNull();
  });
});

describe('resolveNight (full resolution)', () => {
  function makeNightState(mafiaTarget, doctorTarget, inspectorTarget) {
    let state = createInitialGameState();
    state = { ...state, phase: PHASES.NIGHT };
    state = setNightAction(state, 'mafiaTarget', mafiaTarget);
    state = setNightAction(state, 'doctorTarget', doctorTarget);
    state = setNightAction(state, 'inspectorTarget', inspectorTarget);
    return state;
  }

  it('kills a character when unprotected', () => {
    const state = createInitialGameState();
    const victim = state.characters.find(c => c.id !== 'player' && c.role !== 'mafia');
    const nightState = makeNightState(victim.id, null, null);
    const result = resolveNight(nightState);
    const dead = result.characters.find(c => c.id === victim.id);
    expect(dead.alive).toBe(false);
  });

  it('saves a character when doctor protects the target', () => {
    const state = createInitialGameState();
    const victim = state.characters.find(c => c.id !== 'player' && c.role !== 'mafia');
    const nightState = makeNightState(victim.id, victim.id, null);
    const result = resolveNight(nightState);
    const saved = result.characters.find(c => c.id === victim.id);
    expect(saved.alive).toBe(true);
    expect(result.lastNightResult.killResult.type).toBe(RESOLUTION_TYPES.SAVED);
  });

  it('records investigation result privately (requires journalist alliance)', () => {
    const state = createInitialGameState();
    // Ally the journalist to unlock investigations
    const characters = state.characters.map(c =>
      c.role === 'journalist' ? { ...c, alliedWithInspector: true } : c
    );
    const target = characters.find(c => c.id !== 'player');
    let nightState = { ...state, characters, phase: PHASES.NIGHT };
    nightState = setNightAction(nightState, 'mafiaTarget', null);
    nightState = setNightAction(nightState, 'doctorTarget', null);
    nightState = setNightAction(nightState, 'inspectorTarget', target.id);
    const result = resolveNight(nightState);
    expect(result.lastNightResult.investigationResult).not.toBeNull();
    expect(result.lastNightResult.investigationResult.targetId).toBe(target.id);
    expect(result.lastNightResult.investigationResult.role).toBe(target.role);
  });

  it('blocks investigation without journalist alliance', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    let nightState = { ...state, phase: PHASES.NIGHT };
    nightState = setNightAction(nightState, 'mafiaTarget', null);
    nightState = setNightAction(nightState, 'doctorTarget', null);
    nightState = setNightAction(nightState, 'inspectorTarget', target.id);
    const result = resolveNight(nightState);
    expect(result.lastNightResult.investigationResult).toBeNull();
  });

  it('adds investigation to confirmed roles on evidence board', () => {
    const state = createInitialGameState();
    const characters = state.characters.map(c =>
      c.role === 'journalist' ? { ...c, alliedWithInspector: true } : c
    );
    const target = characters.find(c => c.id !== 'player');
    let nightState = { ...state, characters, phase: PHASES.NIGHT };
    nightState = setNightAction(nightState, 'mafiaTarget', null);
    nightState = setNightAction(nightState, 'doctorTarget', null);
    nightState = setNightAction(nightState, 'inspectorTarget', target.id);
    const result = resolveNight(nightState);
    expect(result.evidenceBoard.confirmedRoles[target.id]).toBe(target.role);
  });

  it('logs death to evidence board', () => {
    const state = createInitialGameState();
    const victim = state.characters.find(c => c.id !== 'player' && c.role !== 'mafia');
    const nightState = makeNightState(victim.id, null, null);
    const result = resolveNight(nightState);
    expect(result.evidenceBoard.deathLog).toHaveLength(1);
    expect(result.evidenceBoard.deathLog[0].characterId).toBe(victim.id);
    expect(result.evidenceBoard.deathLog[0].cause).toBe('mafia_kill');
  });

  it('transitions to dawn phase', () => {
    const state = makeNightState(null, null, null);
    const result = resolveNight(state);
    expect(result.phase).toBe('dawn');
  });

  it('flags playerKilledThisNight when player is killed', () => {
    const state = makeNightState('player', null, null);
    const result = resolveNight(state);
    expect(result.playerKilledThisNight).toBe(true);
    const player = result.characters.find(c => c.id === 'player');
    expect(player.alive).toBe(false);
  });
});

describe('resolveNight — playerEliminate action', () => {
  it('kills the target and adds to deathLog with cause player_eliminate', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player' && c.role !== 'mafia');
    let nightState = { ...state, phase: PHASES.NIGHT };
    nightState = setNightAction(nightState, 'playerEliminate', target.id);
    nightState = setNightAction(nightState, 'mafiaTarget', null);
    nightState = setNightAction(nightState, 'doctorTarget', null);
    nightState = setNightAction(nightState, 'inspectorTarget', null);

    const result = resolveNight(nightState);
    const dead = result.characters.find(c => c.id === target.id);
    expect(dead.alive).toBe(false);

    const deathEntry = result.evidenceBoard.deathLog.find(d => d.characterId === target.id);
    expect(deathEntry).toBeDefined();
    expect(deathEntry.cause).toBe('player_eliminate');
    expect(deathEntry.revealedRole).toBe(target.role);
  });

  it('adds eliminated character to confirmedRoles', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    let nightState = { ...state, phase: PHASES.NIGHT };
    nightState = setNightAction(nightState, 'playerEliminate', target.id);
    nightState = setNightAction(nightState, 'mafiaTarget', null);
    nightState = setNightAction(nightState, 'doctorTarget', null);
    nightState = setNightAction(nightState, 'inspectorTarget', null);

    const result = resolveNight(nightState);
    expect(result.evidenceBoard.confirmedRoles[target.id]).toBe(target.role);
    expect(result.lastNightResult.eliminateResult.targetId).toBe(target.id);
  });

  it('does not eliminate if target is already dead', () => {
    const state = createInitialGameState();
    const target = state.characters.find(c => c.id !== 'player');
    // Kill target first
    const stateWithDead = {
      ...state,
      characters: state.characters.map(c =>
        c.id === target.id ? { ...c, alive: false } : c
      ),
    };
    let nightState = { ...stateWithDead, phase: PHASES.NIGHT };
    nightState = setNightAction(nightState, 'playerEliminate', target.id);
    nightState = setNightAction(nightState, 'mafiaTarget', null);
    nightState = setNightAction(nightState, 'doctorTarget', null);
    nightState = setNightAction(nightState, 'inspectorTarget', null);

    const result = resolveNight(nightState);
    // eliminateResult should be null since target was already dead
    expect(result.lastNightResult.eliminateResult).toBeNull();
  });
});
