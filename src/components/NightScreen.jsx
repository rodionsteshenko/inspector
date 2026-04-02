import { useState } from 'react';
import EvidenceBoard from './EvidenceBoard.jsx';

export default function NightScreen({ gameState, onConfirmNight }) {
  const { day, characters, investigationsUsed, investigationsAvailable } = gameState;
  const aliveNpcs = characters.filter(c => c.alive && c.id !== 'player');
  const canInvestigate = investigationsUsed < investigationsAvailable;

  // Check if journalist alliance is active (gates investigation ability)
  const journalist = characters.find(c => c.role === 'journalist');
  const hasJournalistAlly = journalist && journalist.alliedWithInspector;

  const [selectedInvestigate, setSelectedInvestigate] = useState(null);
  const [selectedEliminate, setSelectedEliminate] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);

  const handleConfirm = () => {
    onConfirmNight(selectedInvestigate, selectedEliminate);
  };

  const handleSelectEliminate = (id) => {
    setSelectedEliminate(prev => prev === id ? null : id);
    if (selectedInvestigate === id) setSelectedInvestigate(null);
  };

  const handleSelectInvestigate = (id) => {
    setSelectedInvestigate(prev => prev === id ? null : id);
    if (selectedEliminate === id) setSelectedEliminate(null);
  };

  return (
    <div data-testid="night-screen" className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden">
      {/* Evidence sidebar — toggleable on mobile, always visible on desktop */}
      <div className={`${showEvidence ? 'flex' : 'hidden'} md:flex md:w-72 flex-shrink-0 h-full flex-col border-r border-slate-800`}>
        <EvidenceBoard gameState={gameState} />
      </div>

      {/* Main night actions */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* Mobile evidence toggle */}
        <div className="md:hidden mb-4 flex justify-end">
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-xs text-slate-500 border border-slate-700 rounded px-3 py-1.5 hover:text-slate-300 hover:border-slate-500 transition-colors"
          >
            {showEvidence ? 'Hide Evidence' : 'Show Evidence'}
          </button>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-slate-600 text-xs uppercase tracking-widest mb-2">Night {day}</div>
            <h1 className="text-2xl md:text-3xl text-slate-300 font-serif mb-2">Darkness Falls</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              The village sleeps — or pretends to. Choose your actions carefully.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4">
            {/* Investigate section */}
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
                {!hasJournalistAlly ? (
                  <span className="text-slate-600">Investigate — <span className="italic">requires journalist alliance</span></span>
                ) : canInvestigate ? (
                  'Investigate — choose a target, or let the journalist pick'
                ) : (
                  'Investigate (spent)'
                )}
              </div>
              {hasJournalistAlly && canInvestigate ? (
                <div className="space-y-2">
                  {aliveNpcs.map(npc => {
                    const isConfirmed = gameState.evidenceBoard?.confirmedRoles?.[npc.id];
                    return (
                      <button
                        key={npc.id}
                        data-testid={`investigate-${npc.id}`}
                        onClick={() => handleSelectInvestigate(npc.id)}
                        className={`w-full p-3 rounded border text-left transition-colors ${
                          selectedInvestigate === npc.id
                            ? 'border-amber-600 bg-amber-950/40 text-amber-300'
                            : isConfirmed
                              ? 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-default'
                              : 'border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-amber-800 text-slate-300'
                        }`}
                      >
                        <div className="text-sm font-medium">
                          {npc.name}
                          {isConfirmed && <span className="text-slate-600 ml-2 text-xs">(known: {isConfirmed})</span>}
                        </div>
                        <div className="text-xs italic text-slate-500 mt-0.5">{npc.personality}</div>
                      </button>
                    );
                  })}
                  {!selectedInvestigate && (
                    <p className="text-blue-600 text-xs italic mt-2">
                      No target selected — {journalist?.name || 'the journalist'} will choose someone to investigate automatically.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 text-sm italic">
                  {!hasJournalistAlly
                    ? 'Find and ally with the Journalist to unlock investigations.'
                    : 'Your investigations are spent.'}
                </p>
              )}
            </div>

            {/* Eliminate section */}
            <div>
              <div className="text-red-700 text-xs uppercase tracking-widest mb-3">
                Eliminate — kills tonight, cannot be undone
              </div>
              <div className="space-y-2">
                {aliveNpcs.map(npc => (
                  <button
                    key={npc.id}
                    data-testid={`eliminate-${npc.id}`}
                    onClick={() => handleSelectEliminate(npc.id)}
                    className={`w-full p-3 rounded border text-left transition-colors ${
                      selectedEliminate === npc.id
                        ? 'border-red-600 bg-red-950/40 text-red-300'
                        : 'border-slate-800 bg-slate-900 hover:bg-red-950/20 hover:border-red-900 text-slate-400'
                    }`}
                  >
                    <div className="text-sm font-medium">{npc.name}</div>
                    <div className="text-xs italic text-slate-600 mt-0.5">{npc.personality}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary of selected actions */}
          <div className="mb-4 text-xs text-slate-600 space-y-1 text-center">
            {selectedInvestigate && (
              <div className="text-amber-700">
                Investigating: {aliveNpcs.find(n => n.id === selectedInvestigate)?.name}
              </div>
            )}
            {selectedEliminate && (
              <div className="text-red-700">
                Eliminating: {aliveNpcs.find(n => n.id === selectedEliminate)?.name}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              data-testid="confirm-night-btn"
              onClick={handleConfirm}
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-700 text-amber-400 rounded transition-colors text-sm"
            >
              {selectedInvestigate || selectedEliminate ? 'Confirm Night Actions' : 'Pass — do nothing'}
            </button>
          </div>

          {hasJournalistAlly && (
            <div className="text-center mt-4 text-xs text-slate-700">
              Investigations: {investigationsUsed}/{investigationsAvailable}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
