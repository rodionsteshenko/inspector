import { useState } from 'react';
import { getNodeById, MAP_NODES } from '../engine/map.js';

// Map chunk number to time-of-day label (assumes 8 chunks/day)
function chunkToTime(chunk, chunksPerDay = 8) {
  const ratio = chunk / chunksPerDay;
  if (ratio <= 0.25) return 'Early Morning';
  if (ratio <= 0.5)  return 'Morning';
  if (ratio <= 0.625) return 'Midday';
  if (ratio <= 0.75) return 'Afternoon';
  if (ratio <= 0.875) return 'Evening';
  return 'Dusk';
}

function Timestamp({ day, chunk, chunksPerDay }) {
  return (
    <span className="text-slate-600 text-xs">
      Day {day}, {chunkToTime(chunk, chunksPerDay)}
    </span>
  );
}

export default function CharacterDossier({ character, gameState, onClose }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  async function generateSummary() {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await fetch('/api/dossier-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, gameState }),
      });
      const data = await res.json();
      setSummary(data.summary || 'No summary available.');
    } catch (e) {
      setSummary('Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  }
  const { evidenceBoard, characters, mapConfig, chunksPerDay = 8 } = gameState;
  const nodes = mapConfig?.nodes || MAP_NODES;
  const { confirmedRoles, movementLogs, contradictions, deathLog, alliances,
          conversationLogs = [], claimedFacts = [], proximityFlags = [],
          allyObservations = [] } = evidenceBoard;

  const getLocName = (locId) => getNodeById(locId, nodes)?.name || locId;
  const getCharName = (id) => characters.find(c => c.id === id)?.name || id;

  const charId = character.id;
  const knownRole = confirmedRoles[charId];
  const isAllied = alliances.some(a => a.characterId === charId);
  const death = deathLog.find(d => d.characterId === charId);

  // Movement trail — what the player has directly observed
  const myMovements = movementLogs
    .filter(l => l.characterId === charId)
    .sort((a, b) => a.day !== b.day ? a.day - b.day : a.chunk - b.chunk);

  // Ally-sourced observations of this character
  const allyObs = allyObservations
    .filter(o => o.subjectId === charId)
    .sort((a, b) => a.day !== b.day ? a.day - b.day : a.chunk - b.chunk);

  // What this character said directly to the player
  const theirConvos = conversationLogs.filter(l => l.characterId === charId);

  // What this character claimed about their own location
  const theirClaims = claimedFacts
    .filter(f => f.type === 'location_claim' && f.characterId === charId)
    .sort((a, b) => a.day !== b.day ? a.day - b.day : a.chunk - b.chunk);

  // What others said about this character
  const saidAboutThem = claimedFacts
    .filter(f => f.type === 'observation_claim' && f.subjectId === charId)
    .sort((a, b) => a.day !== b.day ? a.day - b.day : a.chunk - b.chunk);

  // Contradictions involving this character
  const theirContradictions = contradictions.filter(c => c.characterId === charId);

  // Proximity flags
  const theirProximity = proximityFlags.filter(f => f.characterId === charId);

  const hasAnything = myMovements.length > 0 || theirConvos.length > 0 ||
    theirClaims.length > 0 || saidAboutThem.length > 0 || allyObs.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={`/images/characters/${charId}.png`}
            alt={character.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-700 flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="text-slate-200 text-sm font-semibold truncate">{character.name}</div>
            <div className="flex items-center gap-2 text-xs">
              {!character.alive && <span className="text-slate-600">deceased</span>}
              {knownRole && (
                <span className={`font-semibold capitalize ${
                  knownRole === 'mafia' ? 'text-red-400' :
                  knownRole === 'doctor' ? 'text-green-400' :
                  knownRole === 'journalist' ? 'text-blue-400' :
                  knownRole === 'mason' ? 'text-purple-400' : 'text-slate-400'
                }`}>{knownRole}</span>
              )}
              {isAllied && <span className="text-purple-400">★ ally</span>}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-400 text-lg leading-none flex-shrink-0 ml-2"
          title="Back to evidence board"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">

        {/* AI Summary */}
        <section>
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="w-full px-3 py-2 text-xs rounded border border-amber-800 bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {summaryLoading ? '🔍 Analyzing evidence…' : '🔍 Analyze this suspect'}
          </button>
          {summary && (
            <div className="mt-2 px-3 py-2 rounded border border-slate-700 bg-slate-800/50 text-slate-300 leading-relaxed">
              {summary}
            </div>
          )}
        </section>

        {/* Contradictions — show first if any */}
        {theirContradictions.length > 0 && (
          <section>
            <h3 className="text-red-500 uppercase tracking-wider text-xs mb-2">⚠ Contradictions</h3>
            <ul className="space-y-1">
              {theirContradictions.map((c, i) => (
                <li key={i} className="text-red-400 bg-red-950/30 rounded px-2 py-1">
                  {c.description || 'Location contradiction detected'}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Movement trail — what you personally observed */}
        {myMovements.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">You saw them at</h3>
            <ul className="space-y-1">
              {myMovements.map((log, i) => (
                <li key={i} className="flex justify-between text-slate-400">
                  <span className="text-slate-300">{getLocName(log.location)}</span>
                  <Timestamp day={log.day} chunk={log.chunk} chunksPerDay={chunksPerDay} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ally intel about them */}
        {allyObs.length > 0 && (
          <section>
            <h3 className="text-green-600 uppercase tracking-wider text-xs mb-2">Ally intel</h3>
            <ul className="space-y-1">
              {allyObs.map((obs, i) => (
                <li key={i} className="flex justify-between text-green-400">
                  <span>
                    <span className="text-green-600">[{obs.allyName}]</span>{' '}
                    {getLocName(obs.location)}
                  </span>
                  <Timestamp day={obs.day} chunk={obs.chunk} chunksPerDay={chunksPerDay} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* What they claimed about their own whereabouts */}
        {theirClaims.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">They claimed to be at</h3>
            <ul className="space-y-1">
              {theirClaims.map((fact, i) => (
                <li key={i} className="flex justify-between">
                  <span className={fact.verified ? 'text-green-400' : 'text-slate-400'}>
                    {getLocName(fact.location)}
                    {fact.verified && <span className="text-green-600 ml-1">✓</span>}
                  </span>
                  <Timestamp day={fact.day} chunk={fact.chunk} chunksPerDay={chunksPerDay} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* What others said about them */}
        {saidAboutThem.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Others placed them at</h3>
            <ul className="space-y-1">
              {saidAboutThem.map((fact, i) => (
                <li key={i} className="text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-slate-300">{getLocName(fact.location)}</span>
                    <Timestamp day={fact.day} chunk={fact.chunk} chunksPerDay={chunksPerDay} />
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    — {fact.observerName}
                    {fact.verified && <span className="text-green-600 ml-1">✓</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Proximity to victims */}
        {theirProximity.length > 0 && (
          <section>
            <h3 className="text-orange-500 uppercase tracking-wider text-xs mb-2">Near a victim</h3>
            <ul className="space-y-1">
              {theirProximity.map((f, i) => (
                <li key={i} className="text-orange-400">
                  Near {getCharName(f.victimId)} on Day {f.day}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Conversations */}
        {theirConvos.length > 0 && (
          <section>
            <h3 className="text-slate-500 uppercase tracking-wider text-xs mb-2">Conversations</h3>
            <ul className="space-y-3">
              {theirConvos.map((log, i) => (
                <li key={i} className="border-l-2 border-slate-700 pl-2">
                  <div className="text-slate-600 text-xs mb-0.5">Day {log.day}</div>
                  {log.question && (
                    <div className="text-slate-500 italic mb-0.5">You: "{log.question}"</div>
                  )}
                  <div className="text-slate-300 leading-snug">
                    "{log.response?.length > 120
                      ? log.response.slice(0, 120) + '…'
                      : log.response}"
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!hasAnything && (
          <p className="text-slate-600 italic">Nothing on record yet. Talk to them or observe their movements.</p>
        )}

        {/* Death record */}
        {death && (
          <section className="border-t border-slate-800 pt-3 mt-2">
            <div className="text-slate-600">
              Died Day {death.day} — {death.cause === 'vote' ? 'voted out by the village' : 'killed in the night'}
              {death.revealedRole && (
                <span className="ml-1">
                  (was <span className={`font-semibold capitalize ${
                    death.revealedRole === 'mafia' ? 'text-red-400' : 'text-slate-400'
                  }`}>{death.revealedRole}</span>)
                </span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
