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

const LOCATION_NAMES = {
  town_square: 'the Town Square',
  church: 'the Church',
  docks: 'the Docks',
  market: 'the Market',
  tavern: 'the Tavern',
  library: 'the Library',
  alley: 'the Alley',
  cellar: 'the Cellar',
};

export default function CharacterRevealScreen({ gameState, onBeginDay }) {
  const { characters, masonKnownInnocent, day0Murder } = gameState;
  const player = characters.find(c => c.id === 'player');
  const npcs = characters.filter(c => c.id !== 'player');
  const mafiaCount = characters.filter(c => c.role === 'mafia').length;

  const locationLabel = day0Murder
    ? (LOCATION_NAMES[day0Murder.victimLocation] || day0Murder.victimLocation)
    : null;

  return (
    <div data-testid="character-reveal-screen"
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-8">

      {/* Murder announcement — the reason you're here */}
      {day0Murder && (
        <div className="w-full max-w-lg mb-8">
          <div className="border border-red-900 bg-red-950/20 rounded-lg p-5 text-center">
            <div className="text-red-600 text-xs uppercase tracking-widest mb-2">Ashenmoor — Dawn</div>
            <h1 className="text-3xl font-serif text-slate-200 mb-3">
              {day0Murder.victimName} is dead.
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              The body was found this morning near {locationLabel}. The village sent for an inspector.
              You arrived an hour ago. No one knows who you are yet.
            </p>
          </div>
        </div>
      )}

      {/* Fallback flavor if no murder (shouldn't happen) */}
      {!day0Murder && (
        <div className="text-center mb-8 max-w-lg">
          <div className="text-slate-600 text-xs uppercase tracking-widest mb-3">Ashenmoor</div>
          <h1 className="text-3xl font-serif text-slate-300 mb-3">You arrive in the village.</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {mafiaCount === 2 ? 'Two killers walk among you.' : `${mafiaCount} killer${mafiaCount !== 1 ? 's' : ''} walk among you.`}
            {' '}You know your role. They don't know yours — yet.
          </p>
        </div>
      )}

      {/* Player card */}
      <div className="w-full max-w-sm mb-6">
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 text-center">Your Role</div>
        <div data-testid="player-role-card"
          className="p-5 rounded-lg border-2 border-amber-600 bg-amber-950/30 text-center">
          <img
            src="/images/characters/player.png"
            alt="Constantine the Constable"
            className="w-16 h-16 rounded-full border-2 border-amber-600 object-cover mx-auto mb-3"
          />
          <div className="text-amber-300 text-xl font-serif mb-1">{player?.name || 'Constantine the Constable'}</div>
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
              <img
                src={`/images/characters/${npc.id}.png`}
                alt={npc.name}
                className="w-10 h-10 rounded-full border border-slate-700 object-cover flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="text-slate-300 text-xs font-medium truncate">{npc.name}</div>
                <div className="text-slate-600 text-xs italic truncate">???</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Witness hint */}
      {day0Murder && day0Murder.witnesses?.length > 0 && (
        <div className="w-full max-w-lg mt-4 px-4 py-2 rounded border border-slate-800 bg-slate-900 text-center">
          <span className="text-slate-500 text-xs">
            {day0Murder.witnesses[0].name} was seen near the victim last night. They may know something.
          </span>
        </div>
      )}

      {/* Begin Day button */}
      <div className="mt-8">
        <button
          data-testid="begin-day-btn"
          onClick={onBeginDay}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600
            hover:border-amber-700 text-amber-400 rounded-lg transition-colors font-serif"
        >
          Begin the Investigation
        </button>
      </div>
    </div>
  );
}
