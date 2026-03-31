import { useState } from 'react';
import { calculateVotes } from '../engine/winCondition.js';

export default function VoteScreen({ gameState, onVote, onSkip }) {
  const { day, characters, evidenceBoard } = gameState;
  const aliveNpcs = characters.filter(c => c.alive && c.id !== 'player');
  const confirmedMafia = Object.entries(evidenceBoard.confirmedRoles)
    .filter(([, role]) => role === 'mafia')
    .map(([id]) => id);

  const [nominated, setNominated] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // Recent observations for day summary
  const recentLogs = (evidenceBoard.movementLogs || [])
    .filter(l => l.day === day)
    .slice(-6);
  const recentConvos = (evidenceBoard.conversationLogs || [])
    .filter(l => l.day === day);

  function handleNominate(characterId) {
    const result = calculateVotes(gameState, characterId);
    setNominated(characterId);
    setVoteResult(result);
  }

  function handleConfirmVote() {
    onVote(voteResult.winner);
  }

  // Vote result screen
  if (voteResult) {
    const winner = characters.find(c => c.id === voteResult.winner);
    const nominatedChar = characters.find(c => c.id === nominated);

    return (
      <div data-testid="vote-screen" className="h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          <div className="text-red-500/60 text-xs uppercase tracking-widest mb-2">Day {day} — The Verdict</div>
          <h1 className="text-3xl text-slate-200 font-serif mb-6">The Village Has Spoken</h1>

          {/* Vote tally */}
          <div className="bg-slate-900 rounded border border-slate-700 p-4 mb-6 text-left">
            <div className="text-slate-500 text-xs uppercase tracking-wider mb-3">Vote Tally</div>
            {Object.entries(voteResult.votes)
              .sort(([, a], [, b]) => b - a)
              .map(([charId, count]) => {
                const char = characters.find(c => c.id === charId);
                const isWinner = charId === voteResult.winner;
                return (
                  <div key={charId} className={`flex justify-between items-center py-1 text-sm ${
                    isWinner ? 'text-red-300' : 'text-slate-500'
                  }`}>
                    <span>{char?.name || charId}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: count }).map((_, i) => (
                          <span key={i} className={`text-xs ${isWinner ? 'text-red-400' : 'text-slate-600'}`}>▮</span>
                        ))}
                      </div>
                      <span className={isWinner ? 'text-red-400 font-bold' : 'text-slate-600'}>
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Result */}
          <div className={`p-4 rounded border mb-6 ${
            voteResult.winner === nominated
              ? 'border-red-800 bg-red-950/30'
              : 'border-orange-800 bg-orange-950/30'
          }`}>
            {voteResult.winner !== nominated && (
              <div className="text-orange-400 text-xs mb-1">
                The village overruled your nomination.
              </div>
            )}
            <div className="text-slate-300 text-sm">
              <span className="text-red-300 font-medium">{winner?.name}</span>
              {' '}is eliminated.
            </div>
          </div>

          <button
            data-testid="confirm-vote-btn"
            onClick={handleConfirmVote}
            className="px-8 py-3 bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-red-300 rounded transition-colors"
          >
            Proceed to Night
          </button>
        </div>
      </div>
    );
  }

  // Nomination screen
  return (
    <div data-testid="vote-screen" className="h-screen bg-slate-950 flex items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-red-500/60 text-xs uppercase tracking-widest mb-2">Day {day}</div>
          <h1 className="text-3xl text-slate-200 font-serif mb-3">The Village Votes</h1>
          <p className="text-slate-500 text-sm">
            The sun sets. Suspicion hangs in the air. Who do you accuse?
          </p>
        </div>

        {/* Day summary */}
        {(recentConvos.length > 0 || recentLogs.length > 0) && (
          <div className="bg-slate-900/60 rounded border border-slate-800 p-3 mb-5 text-xs text-slate-500">
            <div className="uppercase tracking-wider mb-2 text-slate-600">Today's Summary</div>
            {recentConvos.map((c, i) => (
              <div key={i} className="mb-0.5">
                You spoke with <span className="text-slate-400">{c.characterName}</span>
                {c.question && <span className="text-slate-600"> — "{c.question.slice(0, 50)}..."</span>}
              </div>
            ))}
            {recentConvos.length === 0 && recentLogs.length > 0 && (
              <div>You observed {recentLogs.length} character movement{recentLogs.length !== 1 ? 's' : ''} today.</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          {aliveNpcs.map(npc => {
            const isConfirmedMafia = confirmedMafia.includes(npc.id);
            const isConfirmedInnocent = evidenceBoard.confirmedRoles[npc.id] &&
              evidenceBoard.confirmedRoles[npc.id] !== 'mafia';
            return (
              <button
                key={npc.id}
                data-testid={`vote-${npc.id}`}
                onClick={() => handleNominate(npc.id)}
                className={`p-4 rounded border text-left transition-colors ${
                  isConfirmedMafia
                    ? 'border-red-700 bg-red-950/40 hover:bg-red-900/40'
                    : isConfirmedInnocent
                    ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 opacity-60'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <div className="text-slate-200 font-medium text-sm">{npc.name}</div>
                <div className="text-slate-500 text-xs italic mt-1">{npc.personality}</div>
                {isConfirmedMafia && (
                  <div className="text-red-400 text-xs mt-1">⚠ Confirmed mafia</div>
                )}
                {isConfirmedInnocent && (
                  <div className="text-green-600 text-xs mt-1">✓ Verified innocent</div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            data-testid="skip-vote-btn"
            onClick={onSkip}
            className="px-6 py-3 text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 rounded transition-colors text-sm"
          >
            Hold your tongue — skip the vote
          </button>
        </div>
      </div>
    </div>
  );
}
