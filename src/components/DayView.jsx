import Map from './Map.jsx';
import ActionMenu from './ActionMenu.jsx';
import EvidenceBoard from './EvidenceBoard.jsx';
import ConversationModal from './ConversationModal.jsx';

export default function DayView({ gameState, onMove, onObserve, onTalk, onAlliance, conversationTarget, onCloseConversation, onLogConversation, onSave }) {
  const { day, chunk, characters } = gameState;
  const chunksPerDay = gameState.chunksPerDay || 8;
  const aliveCount = characters.filter(c => c.alive).length;

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-slate-950 md:overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-amber-500 font-semibold tracking-wide text-sm uppercase">
            Rodion the Registrar
          </h1>
          <div className="text-slate-400 text-sm">
            Day <span className="text-slate-200">{day}</span>
            <span className="mx-2 text-slate-700">·</span>
            Chunk <span className="text-slate-200">{chunk}</span>/{chunksPerDay}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-xs">
            {aliveCount} villagers alive
          </span>
          {onSave && (
            <button
              data-testid="save-btn"
              onClick={onSave}
              className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 rounded transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
        {/* Map (top on mobile, left on desktop) */}
        <div className="flex-1 md:overflow-hidden p-2">
          <Map gameState={gameState} onMove={onMove} />
        </div>

        {/* Evidence board (below map on mobile, right sidebar on desktop) */}
        <div className="md:w-72 md:flex-shrink-0">
          <EvidenceBoard gameState={gameState} />
        </div>
      </div>

      {/* Action menu (bottom) */}
      <ActionMenu
        gameState={gameState}
        onMove={onMove}
        onObserve={onObserve}
        onTalk={onTalk}
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
