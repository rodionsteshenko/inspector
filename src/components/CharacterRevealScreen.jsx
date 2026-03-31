// Character reveal screen: show all characters, player role highlighted, others hidden

const ROLE_COLORS = {
  inspector: 'text-amber-400 border-amber-600 bg-amber-950/40',
  mafia: 'text-red-400',
  doctor: 'text-green-400',
  mason: 'text-purple-400',
  journalist: 'text-blue-400',
  citizen: 'text-slate-400',
};

const CHARACTER_INITIALS = {
  brad_barber: 'BB',
  elena_innkeeper: 'EI',
  father_gregor: 'FG',
  mira_merchant: 'MM',
  old_tomas: 'OT',
  dasha_healer: 'DH',
  lev_dockworker: 'LD',
  anya_seamstress: 'AS',
  piotr_miller: 'PM',
  nadia_librarian: 'NL',
  viktor_farmer: 'VF',
  player: 'IN',
};

export default function CharacterRevealScreen({ gameState, onBeginDay }) {
  const { characters, masonKnownInnocent } = gameState;
  const player = characters.find(c => c.id === 'player');
  const npcs = characters.filter(c => c.id !== 'player');
  const mafiaCount = characters.filter(c => c.role === 'mafia').length;

  return (
    <div data-testid="character-reveal-screen"
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-8">

      {/* Flavor text */}
      <div className="text-center mb-8 max-w-lg">
        <div className="text-slate-600 text-xs uppercase tracking-widest mb-3">Ashenmoor</div>
        <h1 className="text-3xl font-serif text-slate-300 mb-3">
          You arrive in the village.
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          {mafiaCount === 2
            ? 'Two killers walk among you.'
            : `${mafiaCount} killer${mafiaCount !== 1 ? 's' : ''} walk among you.`}
          {' '}You know your role. They don't know yours — yet.
        </p>
      </div>

      {/* Player card */}
      <div className="w-full max-w-sm mb-6">
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 text-center">Your Role</div>
        <div data-testid="player-role-card"
          className="p-5 rounded-lg border-2 border-amber-600 bg-amber-950/30 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-amber-600 bg-amber-950/40
            flex items-center justify-center text-amber-400 font-bold text-lg mx-auto mb-3">
            {CHARACTER_INITIALS.player}
          </div>
          <div className="text-amber-300 text-xl font-serif mb-1">{player?.name || 'The Inspector'}</div>
          <div className="text-amber-500 uppercase tracking-widest text-xs mb-2">Inspector</div>
          <p className="text-slate-400 text-xs">
            Investigate one person per night. Reveal yourself to build alliances — at your own risk.
          </p>
        </div>
      </div>

      {/* Mason bonus hint */}
      {masonKnownInnocent && (
        <div className="w-full max-w-sm mb-4 px-4 py-2 rounded border border-purple-800 bg-purple-950/30 text-center">
          <span className="text-purple-400 text-xs">
            The Mason knows one confirmed innocent. Find them.
          </span>
        </div>
      )}

      {/* Other characters */}
      <div className="w-full max-w-2xl">
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-3 text-center">
          The Village ({npcs.length} villagers)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {npcs.map(npc => (
            <div key={npc.id}
              data-testid={`character-card-${npc.id}`}
              className="p-3 rounded border border-slate-800 bg-slate-900 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800
                flex items-center justify-center text-slate-500 text-xs font-mono flex-shrink-0">
                {CHARACTER_INITIALS[npc.id] || npc.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-slate-300 text-xs font-medium truncate">{npc.name}</div>
                <div className="text-slate-600 text-xs italic truncate">???</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Begin Day button */}
      <div className="mt-8">
        <button
          data-testid="begin-day-btn"
          onClick={onBeginDay}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600
            hover:border-amber-700 text-amber-400 rounded-lg transition-colors font-serif"
        >
          Begin Day 1
        </button>
      </div>
    </div>
  );
}
