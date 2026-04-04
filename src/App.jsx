import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createGameWithSetup,
  advanceChunk,
  transitionToDay,
  setNightAction, recordConversation, PHASES
} from './engine/gameState.js';
import { movePlayer, generateLocationObservation, logMovementToEvidence, observeNPCCoPresence } from './engine/movement.js';
import { resolveNight, doctorChooseTarget, mafiaChooseTarget } from './engine/nightResolution.js';
import { checkWinCondition, formAlliance, WIN_STATES } from './engine/winCondition.js';
import { runContradictionCheck } from './engine/evidenceBoard.js';
import { moveNPCs } from './engine/npcMovement.js';
import { saveGame, loadGame } from './engine/saveLoad.js';
import SetupScreen from './components/SetupScreen.jsx';
import CharacterRevealScreen from './components/CharacterRevealScreen.jsx';
import DayView from './components/DayView.jsx';
import NightScreen from './components/NightScreen.jsx';
import DawnScreen from './components/DawnScreen.jsx';
import GameOverScreen from './components/GameOverScreen.jsx';

// Pre-game screens (before game state exists)
const PRE_GAME = {
  SETUP: 'setup',
  REVEAL: 'reveal',
};

function App() {
  const [screen, setScreen] = useState(PRE_GAME.SETUP);
  const [gameState, setGameState] = useState(null);
  const [conversationTarget, setConversationTarget] = useState(null);
  const prevGameStateRef = useRef(null);

  // Auto-save whenever gameState changes during active gameplay
  useEffect(() => {
    if (screen !== 'game' || !gameState) return;
    if (gameState === prevGameStateRef.current) return;
    prevGameStateRef.current = gameState;
    // Don't auto-save on game over (let player start fresh)
    if (gameState.phase !== PHASES.GAME_OVER) {
      saveGame(gameState);
    }
  }, [gameState, screen]);

  // ── Setup / Reveal handlers ─────────────────────────────────────────────

  const handleStartGame = useCallback((config) => {
    const state = createGameWithSetup(config);
    setGameState(state);
    setScreen(PRE_GAME.REVEAL);
  }, []);

  const handleBeginDay = useCallback(() => {
    setScreen('game');
  }, []);

  const handleLoadGame = useCallback((saveId) => {
    const state = loadGame(saveId);
    if (state) {
      setGameState(state);
      setScreen('game');
    }
  }, []);

  const handleSaveGame = useCallback(() => {
    setGameState(prev => {
      if (prev) saveGame(prev);
      return prev;
    });
  }, []);

  // ── Game helpers ────────────────────────────────────────────────────────

  const checkAndApplyWin = useCallback((state) => {
    const result = checkWinCondition(state);
    if (result.state !== WIN_STATES.IN_PROGRESS) {
      return {
        ...state,
        phase: PHASES.GAME_OVER,
        gameOver: true,
        winner: result.state === WIN_STATES.PLAYER_WINS ? 'player' : 'mafia',
        winReason: result.reason,
      };
    }
    return state;
  }, []);

  // Set NPC night targets when day transitions to night
  const setNPCNightTargets = useCallback((state) => {
    if (state.phase !== PHASES.NIGHT) return state;
    const mafiaTarget = mafiaChooseTarget(state);
    const doctorTarget = doctorChooseTarget(state);
    let s = state;
    if (mafiaTarget) s = setNightAction(s, 'mafiaTarget', mafiaTarget);
    if (doctorTarget) s = setNightAction(s, 'doctorTarget', doctorTarget);
    return s;
  }, []);

  // ── Day phase handlers ──────────────────────────────────────────────────

  // End the current chunk: NPCs observe each other, then move to positions for NEXT chunk.
  // Order: player acts → NPCs observe at current positions → chunk advances → NPCs move to next positions.
  // This means the player always sees NPC positions BEFORE acting, not after.
  const endChunk = useCallback((state) => {
    let s = observeNPCCoPresence(state); // NPCs record who they're with right now
    s = advanceChunk(s);                 // chunk counter increments (may flip to NIGHT)
    if (s.phase === PHASES.DAY) {
      s = moveNPCs(s);                   // NPCs move to their positions for the NEW chunk
    }
    s = setNPCNightTargets(s);
    return checkAndApplyWin(s);
  }, [checkAndApplyWin, setNPCNightTargets]);

  const handleMove = useCallback((toLocation) => {
    setGameState(prev => {
      try {
        let s = movePlayer(prev, toLocation);
        return endChunk(s);
      } catch (e) {
        console.error('Move failed:', e.message);
        return prev;
      }
    });
  }, [endChunk]);

  const handleObserve = useCallback(() => {
    setGameState(prev => {
      if (prev.phase !== PHASES.DAY) return prev;
      const obs = generateLocationObservation(prev, 'player');
      let s = prev;
      if (obs) {
        let board = prev.evidenceBoard;
        for (const charId of obs.presentCharacterIds) {
          board = logMovementToEvidence(board, charId, obs.location, obs.day, obs.chunk, 'player');
        }
        s = { ...prev, evidenceBoard: board };
      }
      return endChunk(s);
    });
  }, [endChunk]);

  const handleTalk = useCallback((targetId) => {
    setGameState(prev => {
      if (prev.conversationsUsed >= prev.conversationsAvailable) return prev;
      try {
        return recordConversation(prev);
      } catch (e) {
        console.error('Talk failed:', e.message);
        return prev;
      }
    });
    setConversationTarget(targetId);
  }, []);

  const handleLogConversation = useCallback((targetId, monologue) => {
    setGameState(prev => {
      const character = prev.characters.find(c => c.id === targetId);
      const entry = {
        characterId: targetId,
        characterName: character?.name || targetId,
        location: prev.playerLocation,
        day: prev.day,
        chunk: prev.chunk,
        response: monologue,
      };

      // Add testimony location claims as claimedFacts for contradiction detection
      const testimony = character?.testimony || {};
      const locationFacts = (testimony.locationClaims || []).map(claim => ({
        type: 'location_claim',
        characterId: targetId,
        characterName: character?.name || targetId,
        location: claim.claimedLocation,
        day: claim.day,
        chunk: claim.chunk,
        verified: character?.verifiedByInspector && !claim.isLie,
      }));

      // Add this NPC's observations so they can contradict other NPCs' claims
      const npcObs = (testimony.observations || []).map(obs => ({
        witnessId: targetId,
        witnessName: character?.name || targetId,
        subjectId: obs.subjectId,
        subjectName: obs.subjectName,
        location: obs.location,
        day: obs.day,
        chunk: obs.chunk,
      }));

      let newBoard = {
        ...prev.evidenceBoard,
        conversationLogs: [...(prev.evidenceBoard.conversationLogs || []), entry],
        claimedFacts: [...(prev.evidenceBoard.claimedFacts || []), ...locationFacts],
        npcObservations: [...(prev.evidenceBoard.npcObservations || []), ...npcObs],
      };

      // Run contradiction check after adding claimed facts
      newBoard = runContradictionCheck(newBoard);

      return { ...prev, evidenceBoard: newBoard };
    });
  }, []);

  const handleCloseConversation = useCallback(() => {
    setConversationTarget(null);
    setGameState(prev => {
      try {
        return endChunk(prev);
      } catch (e) {
        return prev;
      }
    });
  }, [endChunk]);

  const handleAlliance = useCallback((characterId) => {
    setGameState(prev => {
      const s = formAlliance(prev, characterId);
      // formAlliance with mafia returns gameOver: true directly
      if (s.gameOver) {
        return { ...s, phase: PHASES.GAME_OVER };
      }
      return checkAndApplyWin(s);
    });
  }, [checkAndApplyWin]);

  // ── Night handlers ───────────────────────────────────────────────────────

  const handleConfirmNight = useCallback((investigateId, eliminateId) => {
    setGameState(prev => {
      let s = prev;
      if (investigateId) s = setNightAction(s, 'inspectorTarget', investigateId);
      if (eliminateId) s = setNightAction(s, 'playerEliminate', eliminateId);
      s = resolveNight(s);
      return checkAndApplyWin(s);
    });
  }, [checkAndApplyWin]);

  // ── Dawn handler ─────────────────────────────────────────────────────────

  const handleDawnContinue = useCallback(() => {
    setGameState(prev => {
      const s = transitionToDay(prev);
      return checkAndApplyWin(s);
    });
  }, [checkAndApplyWin]);

  // ── New Game ────────────────────────────────────────────────────────────

  const handleNewGame = useCallback(() => {
    setGameState(null);
    setConversationTarget(null);
    setScreen(PRE_GAME.SETUP);
  }, []);

  // ── Routing ─────────────────────────────────────────────────────────────

  // Pre-game screens
  if (screen === PRE_GAME.SETUP) {
    return <SetupScreen onStartGame={handleStartGame} onLoadGame={handleLoadGame} />;
  }

  if (screen === PRE_GAME.REVEAL && gameState) {
    return <CharacterRevealScreen gameState={gameState} onBeginDay={handleBeginDay} />;
  }

  // Game screens
  if (!gameState) {
    return <SetupScreen onStartGame={handleStartGame} onLoadGame={handleLoadGame} />;
  }

  const { phase } = gameState;

  if (phase === PHASES.GAME_OVER) {
    return <GameOverScreen gameState={gameState} onNewGame={handleNewGame} />;
  }
  if (phase === PHASES.NIGHT) {
    return <NightScreen gameState={gameState} onConfirmNight={handleConfirmNight} />;
  }
  if (phase === PHASES.DAWN) {
    return <DawnScreen gameState={gameState} onContinue={handleDawnContinue} />;
  }

  return (
    <DayView
      gameState={gameState}
      onMove={handleMove}
      onObserve={handleObserve}
      onTalk={handleTalk}
      onAlliance={handleAlliance}
      conversationTarget={conversationTarget}
      onCloseConversation={handleCloseConversation}
      onLogConversation={handleLogConversation}
      onSave={handleSaveGame}
    />
  );
}

export default App;
