import Map from './Map.jsx';
import ActionMenu from './ActionMenu.jsx';
import EvidenceBoard from './EvidenceBoard.jsx';
import ConversationModal from './ConversationModal.jsx';
import { getNodeById } from '../engine/map.js';

export default function DayView({ gameState, onMove, onObserve, onTalk, onCallVote, onAlliance, conversationTarget, onCloseConversation, onLogConversation }) {
  const { day, chunk, characters } = gameState;
  const aliveCount = characters.filter(c => c.alive).length;

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-amber-500 font-semibold tracking-wide text-sm uppercase">
            The Inspector
          </h1>
          <div className="text-slate-400 text-sm">
            Day <span className="text-slate-200">{day}</span>
            <span className="mx-2 text-slate-700">·</span>
            Chunk <span className="text-slate-200">{chunk}</span>/8
          </div>
        </div>
        <div className="text-slate-500 text-xs">
          {aliveCount} villagers alive
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map (left/center) */}
        <div className="flex-1 overflow-hidden p-2">
          <Map gameState={gameState} onMove={onMove} />
        </div>

        {/* Evidence board (right) */}
        <div className="w-72 flex-shrink-0">
          <EvidenceBoard gameState={gameState} />
        </div>
      </div>

      {/* Action menu (bottom) */}
      <ActionMenu
        gameState={gameState}
        onMove={onMove}
        onObserve={onObserve}
        onTalk={onTalk}
        onCallVote={onCallVote}
        onAlliance={onAlliance}
      />

      {/* Conversation modal overlay */}
      {conversationTarget && (
        <ConversationModal
          gameState={gameState}
          targetId={conversationTarget}
          onClose={onCloseConversation}
          onLogConversation={onLogConversation}
          onAlliance={onAlliance}
        />
      )}
    </div>
  );
}
