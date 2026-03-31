import { useState, useCallback } from 'react';
import {
  createGameWithSetup,
  advanceChunk,
  transitionToDay,
  setNightAction, recordConversation, PHASES
} from './engine/gameState.js';
import { movePlayer, generateLocationObservation, logMovementToEvidence } from './engine/movement.js';
import { resolveNight, doctorChooseTarget, mafiaChooseTarget } from './engine/nightResolution.js';
import { checkWinCondition, applyVoteResult, formAlliance, WIN_STATES } from './engine/winCondition.js';
import { runContradictionCheck } from './engine/evidenceBoard.js';
import { moveNPCs } from './engine/npcMovement.js';
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

  // ── Setup / Reveal handlers ─────────────────────────────────────────────

  const handleStartGame = useCallback((config) => {
    const state = createGameWithSetup(config);
    setGameState(state);
    setScreen(PRE_GAME.REVEAL);
  }, []);

  const handleBeginDay = useCallback(() => {
    setScreen('game');
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

  // ── Day phase handlers ──────────────────────────────────────────────────

  const handleMove = useCallback((toLocation) => {
    setGameState(prev => {
      try {
        let s = movePlayer(prev, toLocation);
        s = moveNPCs(s);          // NPCs move each chunk
        s = advanceChunk(s);
        return checkAndApplyWin(s);
      } catch (e) {
        console.error('Move failed:', e.message);
        return prev;
      }
    });
  }, [checkAndApplyWin]);

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
      s = moveNPCs(s);            // NPCs move each chunk
      s = advanceChunk(s);
      return checkAndApplyWin(s);
    });
  }, [checkAndApplyWin]);

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

      let newBoard = {
        ...prev.evidenceBoard,
        conversationLogs: [...(prev.evidenceBoard.conversationLogs || []), entry],
        claimedFacts: [...(prev.evidenceBoard.claimedFacts || []), ...locationFacts],
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
        let s = moveNPCs(prev);   // NPCs move when conversation ends
        s = advanceChunk(s);
        return checkAndApplyWin(s);
      } catch (e) {
        return prev;
      }
    });
  }, [checkAndApplyWin]);

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

  const handleCallVote = useCallback(() => {
    setGameState(prev => {
      if (prev.phase !== PHASES.DAY) return prev;
      // Advance all remaining chunks — advanceChunk goes to NIGHT when day ends
      let s = prev;
      while (s.phase === PHASES.DAY) {
        s = advanceChunk(s);
      }
      // s is now in NIGHT phase; set NPC night targets
      const mafiaTarget = mafiaChooseTarget(s);
      const doctorTarget = doctorChooseTarget(s);
      if (mafiaTarget) s = setNightAction(s, 'mafiaTarget', mafiaTarget);
      if (doctorTarget) s = setNightAction(s, 'doctorTarget', doctorTarget);
      return s;
    });
  }, []);

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
    return <SetupScreen onStartGame={handleStartGame} />;
  }

  if (screen === PRE_GAME.REVEAL && gameState) {
    return <CharacterRevealScreen gameState={gameState} onBeginDay={handleBeginDay} />;
  }

  // Game screens
  if (!gameState) {
    return <SetupScreen onStartGame={handleStartGame} />;
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
      onCallVote={handleCallVote}
      onAlliance={handleAlliance}
      conversationTarget={conversationTarget}
      onCloseConversation={handleCloseConversation}
      onLogConversation={handleLogConversation}
    />
  );
}

export default App;
