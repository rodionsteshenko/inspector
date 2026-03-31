export default function GameOverScreen({ gameState, onNewGame }) {
  const { winner, winReason, day, characters } = gameState;
  const playerWon = winner === 'player';

  const reasonMessages = {
    player_killed:       'The mafia found you. Your investigation ends here.',
    mafia_parity:        'The mafia outnumber the innocents. The village is lost.',
    time_out:            'Five days passed. The mafia remain hidden. The village falls.',
    inspector_revealed:  'You revealed yourself to a mafia member. The village is lost.',
  };

  const aliveNpcs = characters.filter(c => c.alive && c.id !== 'player');
  const mafiaRevealed = characters.filter(c => c.role === 'mafia');

  return (
    <div data-testid="game-over-screen" className="h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <div className={`text-6xl mb-6 ${playerWon ? 'text-amber-400' : 'text-red-600'}`}>
          {playerWon ? '★' : '✕'}
        </div>

        <h1 className={`text-4xl font-serif mb-3 ${playerWon ? 'text-amber-300' : 'text-red-400'}`}>
          {playerWon ? 'Justice Served' : 'Darkness Wins'}
        </h1>

        <p className="text-slate-400 text-sm mb-6">
          {playerWon
            ? `The mafia has been eliminated. The village is safe. Day ${day}.`
            : reasonMessages[winReason] || 'The mafia prevails.'}
        </p>

        {/* Reveal all roles */}
        <div className="bg-slate-900 rounded border border-slate-700 p-4 mb-6 text-left">
          <div className="text-slate-500 text-xs uppercase tracking-wider mb-3">The truth revealed</div>
          <div className="space-y-1">
            {characters.filter(c => c.id !== 'player').map(c => (
              <div key={c.id} className="flex justify-between text-sm">
                <span className={c.alive ? 'text-slate-300' : 'text-slate-600 line-through'}>
                  {c.name}
                </span>
                <span className={
                  c.role === 'mafia' ? 'text-red-400' :
                  c.role === 'doctor' ? 'text-green-400' :
                  c.role === 'journalist' ? 'text-blue-400' :
                  c.role === 'mason' ? 'text-purple-400' :
                  'text-slate-500'
                }>
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          data-testid="new-game-btn"
          onClick={onNewGame}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-700 text-amber-400 rounded transition-colors"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
