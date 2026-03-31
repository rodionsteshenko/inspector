import { getAdjacentLocations, getNodeById } from '../engine/map.js';
import { getCharactersAtLocation } from '../engine/characters.js';

export default function ActionMenu({ gameState, onMove, onObserve, onTalk, onCallVote, onAlliance }) {
  const { playerLocation, characters, phase, conversationsUsed, conversationsAvailable, chunk } = gameState;
  const adjacentLocations = getAdjacentLocations(playerLocation);
  const npcsHere = getCharactersAtLocation(characters, playerLocation).filter(c => c.id !== 'player');
  const conversationsLeft = conversationsAvailable - conversationsUsed;
  const currentNode = getNodeById(playerLocation);

  return (
    <div data-testid="action-menu" className="border-t border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500 uppercase tracking-widest">
          {currentNode?.name} — {currentNode?.description}
        </div>
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Chunk {chunk}/8</span>
          <span className={conversationsLeft === 0 ? 'text-red-500' : 'text-slate-400'}>
            Conversations: {conversationsLeft}/{conversationsAvailable}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Move actions */}
        {adjacentLocations.map(locId => {
          const node = getNodeById(locId);
          return (
            <button
              key={locId}
              data-testid={`move-to-${locId}`}
              onClick={() => onMove(locId)}
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-green-700 text-green-400 rounded transition-colors"
            >
              Move → {node?.name}
            </button>
          );
        })}

        {/* Observe action */}
        <button
          data-testid="observe-btn"
          onClick={onObserve}
          className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-700 text-blue-400 rounded transition-colors"
        >
          Observe quietly
        </button>

        {/* Talk to NPCs at location */}
        {npcsHere.map(npc => (
          <button
            key={npc.id}
            data-testid={`talk-to-${npc.id}`}
            onClick={() => onTalk(npc.id)}
            disabled={conversationsLeft === 0}
            className={`px-3 py-2 text-sm rounded border transition-colors ${
              conversationsLeft === 0
                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 hover:border-amber-700 text-amber-400'
            }`}
          >
            Talk to {npc.name}
          </button>
        ))}

        {/* Ally with NPCs */}
        {npcsHere.filter(npc => !npc.alliedWithInspector).map(npc => (
          <button
            key={`ally-${npc.id}`}
            data-testid={`ally-with-${npc.id}`}
            onClick={() => onAlliance && onAlliance(npc.id)}
            className="px-3 py-2 text-sm bg-slate-800 hover:bg-purple-900/40 border border-slate-600 hover:border-purple-700 text-purple-400 rounded transition-colors"
          >
            Ally with {npc.name} <span className="text-purple-600 text-xs">(⚠ reveals your identity)</span>
          </button>
        ))}

        {/* Call for vote */}
        <button
          data-testid="call-vote-btn"
          onClick={onCallVote}
          className="px-3 py-2 text-sm bg-slate-800 hover:bg-red-900/40 border border-slate-600 hover:border-red-700 text-red-400 rounded transition-colors ml-auto"
        >
          Call for Vote
        </button>
      </div>

      {npcsHere.length === 0 && (
        <p className="text-xs text-slate-600 mt-2 italic">No one else is here.</p>
      )}
    </div>
  );
}
