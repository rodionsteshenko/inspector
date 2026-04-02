import { getNodeById, MAP_NODES } from '../engine/map.js';

const ROLE_COLORS = {
  mafia:      'text-red-400',
  inspector:  'text-amber-400',
  doctor:     'text-green-400',
  journalist: 'text-blue-400',
  mason:      'text-purple-400',
  citizen:    'text-slate-300',
};

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || 'text-slate-400';
  return <span className={`font-semibold capitalize ${color}`}>{role}</span>;
}

export default function EvidenceBoard({ gameState }) {
  const { evidenceBoard, characters, mapConfig } = gameState;
  const nodes = mapConfig?.nodes || MAP_NODES;
  const { confirmedRoles, movementLogs, contradictions, deathLog, alliances } = evidenceBoard;
  const conversationLogs = evidenceBoard.conversationLogs || [];
  const claimedFacts     = evidenceBoard.claimedFacts     || [];
  const proximityFlags   = evidenceBoard.proximityFlags   || [];
  const allyObservations = evidenceBoard.allyObservations || [];

  const getCharName = (id) => {
    const c = characters.find(ch => ch.id === id);
    return c?.name || id;
  };

  const getLocName = (locId) => {
    const node = getNodeById(locId, nodes);
    return node?.name || locId;
  };

  const confirmedEntries = Object.entries(confirmedRoles);
  const hasAny = confirmedEntries.length > 0 || movementLogs.length > 0 ||
    contradictions.length > 0 || deathLog.length > 0 || alliances.length > 0 ||
    conversationLogs.length > 0 || claimedFacts.length > 0 || proximityFlags.length > 0 ||
    allyObservations.length > 0;

  return (
    <div data-testid="evidence-board" className="flex flex-col h-full bg-slate-900 border-l border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
          Evidence Board
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">
        {!hasAny && (
          <p className="text-slate-600 italic">No evidence gathered yet. Move around and observe.</p>
        )}

        {/* Confirmed Roles */}
        {confirmedEntries.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Confirmed Roles</h3>
            <ul className="space-y-1">
              {confirmedEntries.map(([charId, role]) => (
                <li key={charId} className="flex justify-between text-slate-300">
                  <span>{getCharName(charId)}</span>
                  <RoleBadge role={role} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Alliances */}
        {alliances.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Alliances</h3>
            <ul className="space-y-1">
              {alliances.map((a, i) => (
                <li key={i} className="text-purple-300">
                  Allied with {a.characterName}
                  <span className="text-slate-500 ml-1">(Day {a.day})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ally Observations */}
        {allyObservations.length > 0 && (
          <section>
            <h3 className="text-green-600 uppercase tracking-wider text-xs mb-2">Ally Intel</h3>
            <ul className="space-y-1">
              {allyObservations.slice(-20).map((obs, i) => (
                <li key={i} className="text-green-400">
                  <span className="text-green-600 text-xs">[{obs.allyName}]</span>{' '}
                  <span className="text-slate-300">{obs.subjectName}</span>
                  {' '}at{' '}
                  <span className="text-slate-300">{getLocName(obs.location)}</span>
                  <span className="text-slate-600 ml-1">— Day {obs.day}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Contradictions */}
        {contradictions.length > 0 && (
          <section>
            <h3 className="text-red-500 uppercase tracking-wider text-xs mb-2">Contradictions</h3>
            <ul className="space-y-1">
              {contradictions.map((c, i) => (
                <li key={i} className="text-red-400">
                  {getCharName(c.characterId)}: {c.description || 'movement contradiction'}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Movement Logs */}
        {movementLogs.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Movement Logs</h3>
            <ul className="space-y-1">
              {movementLogs.slice(-15).map((log, i) => (
                <li key={i} className="text-slate-400">
                  <span className="text-slate-300">{getCharName(log.characterId)}</span>
                  {' '}seen at{' '}
                  <span className="text-slate-300">{getLocName(log.location)}</span>
                  <span className="text-slate-600 ml-1">— {log.timestamp}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Death Log */}
        {deathLog.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Deaths</h3>
            <ul className="space-y-1">
              {deathLog.map((d, i) => (
                <li key={i} className="text-slate-500">
                  <span className="text-slate-400">{d.characterName}</span>
                  {' '}— Day {d.day},{' '}
                  {d.cause === 'vote' ? 'voted out' : 'killed'}
                  {d.revealedRole && (
                    <span> (<RoleBadge role={d.revealedRole} />)</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Claimed Facts (extracted from conversations) */}
        {claimedFacts.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Claimed Facts</h3>
            <ul className="space-y-1">
              {claimedFacts.slice(-20).map((fact, i) => {
                const locName = getLocName(fact.location);
                const tag = fact.verified
                  ? <span className="text-green-600 ml-1">[verified]</span>
                  : <span className="text-slate-600 ml-1">[unverified]</span>;
                if (fact.type === 'location_claim') {
                  return (
                    <li key={i} className="text-slate-400">
                      <span className="text-slate-300">{fact.characterName}</span>
                      {' '}claims to have been at{' '}
                      <span className="text-slate-300">{locName}</span>
                      {tag}
                    </li>
                  );
                }
                if (fact.type === 'observation_claim') {
                  return (
                    <li key={i} className="text-slate-400">
                      <span className="text-slate-300">{fact.observerName}</span>
                      {' '}says{' '}
                      <span className="text-slate-300">{fact.subjectName}</span>
                      {' '}was at{' '}
                      <span className="text-slate-300">{locName}</span>
                      {tag}
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          </section>
        )}

        {/* Proximity Flags (post-death evidence) */}
        {proximityFlags.length > 0 && (
          <section>
            <h3 className="text-orange-500 uppercase tracking-wider text-xs mb-2">Near Victim</h3>
            <ul className="space-y-1">
              {proximityFlags.map((f, i) => (
                <li key={i} className="text-orange-400">
                  <span className="text-slate-300">{getCharName(f.characterId)}</span>
                  {' '}was near <span className="text-slate-300">{getCharName(f.victimId)}</span>
                  <span className="text-slate-600"> on Day {f.day}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Conversation Logs */}
        {conversationLogs.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Conversations</h3>
            <ul className="space-y-2">
              {conversationLogs.slice(-10).map((log, i) => (
                <li key={i} className="border-l-2 border-slate-700 pl-2">
                  <div className="text-slate-300 font-medium">{log.characterName}</div>
                  <div className="text-slate-500 italic">Q: {log.question}</div>
                  <div className="text-slate-400 mt-0.5 leading-snug">
                    "{log.response.length > 90
                      ? log.response.slice(0, 90) + '...'
                      : log.response}"
                  </div>
                  <div className="text-slate-700 text-xs mt-0.5">Day {log.day}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
