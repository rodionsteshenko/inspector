// Alliance confirmation screen — shows everything the Inspector knows about this person
// before committing to the mutual reveal (which exposes your identity to the NPC).

import { chunkToTimeLabel } from '../engine/timeOfDay.js';

const LOCATION_LABELS = {
  town_square: 'Town Square', church: 'Church', docks: 'Docks',
  market: 'Market', tavern: 'Tavern', library: 'Library',
  alley: 'Alley', cellar: 'Cellar',
};
function loc(id) { return LOCATION_LABELS[id] || (id || '').replace(/_/g, ' '); }

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon, children, empty }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-500 text-xs uppercase tracking-widest">{icon} {title}</span>
      </div>
      {empty
        ? <p className="text-slate-600 text-xs italic pl-1">{empty}</p>
        : children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AllianceConfirmModal({ gameState, targetId, onConfirm, onCancel }) {
  const npc = gameState.characters.find(c => c.id === targetId);
  if (!npc) return null;

  const { evidenceBoard } = gameState;

  // --- 1. Confirmed role (from night investigation) ---
  const confirmedRole = evidenceBoard.confirmedRoles?.[targetId] || null;

  // --- 2. Movement logs the Inspector personally observed for this person ---
  const myMovementObs = (evidenceBoard.movementLogs || [])
    .filter(e => e.characterId === targetId)
    .sort((a, b) => a.day !== b.day ? a.day - b.day : a.chunk - b.chunk);

  // --- 3. Conversation logs with this NPC ---
  const convLogs = (evidenceBoard.conversationLogs || [])
    .filter(e => e.characterId === targetId);

  // --- 4. What this NPC claimed in conversations (their location claims) ---
  const theirClaims = (npc.testimony?.locationClaims || [])
    .filter(c => !c.isOmitted)
    .sort((a, b) => a.day !== b.day ? a.day - b.day : a.chunk - b.chunk);

  // --- 5. Contradictions involving this NPC ---
  const contradictions = (evidenceBoard.contradictions || [])
    .filter(c => c.characterId === targetId || c.witnessId === targetId);

  // --- 6. What other NPCs said they saw this person do ---
  const npcObsAboutTarget = (evidenceBoard.npcObservations || [])
    .filter(o => o.subjectId === targetId);

  // --- 7. Alliance status ---
  const alreadyAllied = npc.alliedWithInspector;

  // Role badge
  const roleBadge = confirmedRole ? (
    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
      confirmedRole === 'mafia'
        ? 'bg-red-900/60 border border-red-700 text-red-300'
        : 'bg-green-900/40 border border-green-700 text-green-300'
    }`}>
      {confirmedRole.toUpperCase()} — confirmed by investigation
    </span>
  ) : (
    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-600 text-slate-500">
      Role unknown
    </span>
  );

  const riskWarning = !confirmedRole && (
    <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3 mb-5 text-amber-300 text-sm">
      ⚠️ <strong>You have not confirmed this person's role.</strong> If they are mafia, they will learn your identity and you will be killed tonight.
    </div>
  );

  const confirmedSafeMsg = confirmedRole && confirmedRole !== 'mafia' && (
    <div className="bg-green-950/40 border border-green-800/50 rounded-lg p-3 mb-5 text-green-300 text-sm">
      ✓ You have confirmed this person is <strong>{confirmedRole}</strong>. Alliance is safe.
    </div>
  );

  const confirmedMafiaMsg = confirmedRole === 'mafia' && (
    <div className="bg-red-950/60 border border-red-700 rounded-lg p-3 mb-5 text-red-300 text-sm font-medium">
      ✗ THIS PERSON IS MAFIA. Forming an alliance will get you killed.
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <img
            src={`/images/characters/${targetId}.png`}
            alt={npc.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-slate-700"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div>
            <h2 className="text-xl font-serif text-amber-400">{npc.name}</h2>
            <p className="text-slate-500 text-xs italic">{npc.personality}</p>
            <div className="mt-1">{roleBadge}</div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {riskWarning}
          {confirmedSafeMsg}
          {confirmedMafiaMsg}

          {/* What you know: movement observations */}
          <Section title="Movements You've Observed" icon="👁️"
            empty={myMovementObs.length === 0 ? 'You haven\'t personally observed this person at any location.' : null}>
            {myMovementObs.length > 0 && (
              <ul className="space-y-1">
                {myMovementObs.map((e, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-slate-600 text-xs w-28 flex-shrink-0">Day {e.day}, {chunkToTimeLabel(e.chunk, gameState.chunksPerDay || 8)}</span>
                    <span>Seen at <span className="text-amber-400">{loc(e.location)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* What they claimed in conversations */}
          <Section title="What They've Claimed" icon="💬"
            empty={theirClaims.length === 0 && convLogs.length === 0 ? 'You haven\'t spoken with this person.' : null}>
            {theirClaims.length > 0 && (
              <ul className="space-y-1 mb-2">
                {theirClaims.map((c, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-slate-600 text-xs w-28 flex-shrink-0">Day {c.day}, {chunkToTimeLabel(c.chunk, gameState.chunksPerDay || 8)}</span>
                    <span>Claimed: <span className="text-blue-300">{loc(c.claimedLocation)}</span></span>
                  </li>
                ))}
              </ul>
            )}
            {convLogs.map((log, i) => (
              <div key={i} className="bg-slate-900 rounded p-2 mb-1 text-xs text-slate-400 italic border border-slate-800">
                "{log.response}"
                <span className="text-slate-600 ml-2">— Day {log.day}</span>
              </div>
            ))}
          </Section>

          {/* What other villagers said about them */}
          <Section title="Reported by Others" icon="🗣️"
            empty={npcObsAboutTarget.length === 0 ? 'No other villagers have mentioned seeing this person.' : null}>
            {npcObsAboutTarget.length > 0 && (
              <ul className="space-y-1">
                {npcObsAboutTarget.map((o, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-slate-600 text-xs w-28 flex-shrink-0">Day {o.day}, {chunkToTimeLabel(o.chunk, gameState.chunksPerDay || 8)}</span>
                    <span>
                      <span className="text-slate-400">{o.witnessName}</span> saw them at{' '}
                      <span className="text-amber-400">{loc(o.location)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Contradictions */}
          {contradictions.length > 0 && (
            <Section title="Contradictions Flagged" icon="⚡">
              <ul className="space-y-1">
                {contradictions.map((c, i) => (
                  <li key={i} className="text-red-300 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                    {c.description || `Claimed ${loc(c.claimedLocation)} but ${c.witnessName || 'witness'} said ${loc(c.witnessedLocation)}`}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* NPC personality note */}
          <Section title="Your Read on Them" icon="🧠">
            <p className="text-slate-400 text-sm italic">"{npc.personality}"</p>
            <p className="text-slate-600 text-xs mt-1">
              {convLogs.length > 0
                ? `You've spoken with them ${convLogs.length} time${convLogs.length > 1 ? 's' : ''}.`
                : 'You have not spoken with them directly.'}
              {myMovementObs.length > 0
                ? ` You've observed them at ${myMovementObs.length} location${myMovementObs.length > 1 ? 's' : ''}.`
                : ''}
            </p>
          </Section>

          {/* Alliance mechanic explanation */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-500">
            <strong className="text-slate-400">Alliance is a mutual reveal.</strong> You tell them you're the Inspector. They tell you their true role.
            If they're innocent, you gain an ally and their ability. If they're mafia — you die tonight.
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid={`confirm-alliance-${targetId}`}
            onClick={() => onConfirm(targetId)}
            disabled={alreadyAllied}
            className={`px-5 py-2 text-sm rounded border transition-colors font-medium ${
              confirmedRole === 'mafia'
                ? 'bg-red-900/60 hover:bg-red-800/60 border-red-700 text-red-300'
                : 'bg-purple-900/40 hover:bg-purple-800/50 border-purple-700 text-purple-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {confirmedRole === 'mafia' ? '☠️ Form Alliance Anyway' : '🤝 Form Alliance'}
          </button>
        </div>
      </div>
    </div>
  );
}
