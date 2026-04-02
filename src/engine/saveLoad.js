// Save/load game state to localStorage

import { buildAdjacencyMap } from './map.js';

const SAVE_KEY = 'mafia_game_saves';
const MAX_SAVES = 20;

export function getSavedGames() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGame(gameState) {
  const saves = getSavedGames();
  const mapName = gameState.mapConfig?.name || 'Unknown';
  const aliveCount = gameState.characters.filter(c => c.alive).length;
  const entry = {
    id: Date.now().toString(),
    name: `Day ${gameState.day} — ${mapName} — ${aliveCount} alive`,
    timestamp: Date.now(),
    day: gameState.day,
    phase: gameState.phase,
    playerCount: gameState.characters.length,
    mapLayout: gameState.mapConfig?.id,
    state: gameState,
  };
  saves.unshift(entry);
  if (saves.length > MAX_SAVES) saves.length = MAX_SAVES;
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  return entry;
}

export function loadGame(saveId) {
  const saves = getSavedGames();
  const save = saves.find(s => s.id === saveId);
  if (!save) return null;

  const state = save.state;
  // Rehydrate adjacencyMap (in case it was lost during serialization)
  if (state.mapConfig && state.mapConfig.nodes && state.mapConfig.edges) {
    state.mapConfig.adjacencyMap = buildAdjacencyMap(state.mapConfig.nodes, state.mapConfig.edges);
  }
  return state;
}

export function deleteSave(saveId) {
  const saves = getSavedGames().filter(s => s.id !== saveId);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}
