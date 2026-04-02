export default function DawnScreen({ gameState, onContinue }) {
  const { day, lastNightResult, characters } = gameState;
  if (!lastNightResult) return null;

  const { killResult, investigationResult, investigationSource, eliminateResult } = lastNightResult;
  const nextDay = day + 1;

  const getCharName = (id) => characters.find(c => c.id === id)?.name || id;

  return (
    <div data-testid="dawn-screen" className="h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="text-amber-700/60 text-xs uppercase tracking-widest mb-3">Dawn — Day {day} ends</div>
          <h1 className="text-3xl text-slate-200 font-serif mb-3">A New Morning</h1>
        </div>

        <div className="space-y-4 mb-8">
          {/* Kill result */}
          {killResult.type === 'killed' && killResult.victim && (
            <div className="p-4 rounded border border-red-800 bg-red-950/30">
              <div className="text-red-400 font-semibold mb-1">A body is found</div>
              <p className="text-slate-300 text-sm">
                {getCharName(killResult.victim)} was killed during the night.
              </p>
            </div>
          )}

          {killResult.type === 'saved' && killResult.victim && (
            <div className="p-4 rounded border border-green-800 bg-green-950/20">
              <div className="text-green-400 font-semibold mb-1">Saved by the healer</div>
              <p className="text-slate-300 text-sm">
                The doctor protected {getCharName(killResult.victim)} — they survived the night.
              </p>
            </div>
          )}

          {killResult.type === 'no_kill' && (
            <div className="p-4 rounded border border-slate-700 bg-slate-900">
              <div className="text-slate-400 font-semibold mb-1">A quiet night</div>
              <p className="text-slate-400 text-sm">No one was harmed.</p>
            </div>
          )}

          {/* Investigation result (private to player) */}
          {investigationResult && (
            <div className="p-4 rounded border border-amber-800/50 bg-amber-950/20">
              <div className="text-amber-500 font-semibold mb-1 text-xs uppercase tracking-wider">
                {investigationSource === 'journalist_auto' ? 'Journalist Investigation' : 'Your Investigation'} (private)
              </div>
              <p className="text-slate-300 text-sm">
                {investigationSource === 'journalist_auto'
                  ? 'Your journalist ally investigated'
                  : 'You investigated'}{' '}
                <span className="text-slate-200 font-medium">{investigationResult.targetName}</span>.
                {' '}They are{' '}
                <span className={investigationResult.isMafia ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                  {investigationResult.isMafia ? 'MAFIA' : `a ${investigationResult.role}`}
                </span>.
              </p>
            </div>
          )}

          {!investigationResult && (
            <div className="p-4 rounded border border-slate-800 bg-slate-900">
              <p className="text-slate-600 text-sm italic">
                {gameState.characters.find(c => c.role === 'journalist')?.alliedWithInspector
                  ? 'No investigation targets remain.'
                  : 'Ally with the Journalist to unlock investigations.'}
              </p>
            </div>
          )}

          {/* Player eliminate result */}
          {eliminateResult && (
            <div className="p-4 rounded border border-red-800 bg-red-950/20">
              <div className="text-red-400 font-semibold mb-1 text-xs uppercase tracking-wider">
                Your Elimination
              </div>
              <p className="text-slate-300 text-sm">
                You eliminated{' '}
                <span className="text-slate-200 font-medium">{eliminateResult.targetName}</span>.
                {' '}They were{' '}
                <span className={eliminateResult.role === 'mafia' ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                  {eliminateResult.role === 'mafia' ? 'MAFIA' : `a ${eliminateResult.role}`}
                </span>.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            data-testid="dawn-continue-btn"
            onClick={onContinue}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-700 text-amber-400 rounded transition-colors"
          >
            Begin Day {nextDay}
          </button>
        </div>
      </div>
    </div>
  );
}
