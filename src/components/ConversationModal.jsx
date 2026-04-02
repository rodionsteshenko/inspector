import { useState, useEffect } from 'react';

async function apiFetchTestimony(character, gameState) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('/api/testimony', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        characterId: character.id,
        gameContext: { character, gameState },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.monologue) throw new Error('Empty monologue from API');
    return data.monologue;
  } finally {
    clearTimeout(timer);
  }
}

function buildFallbackMonologue(character) {
  const { name, testimony = {} } = character;
  const { locationClaims = [], observations = [], suspicions = [] } = testimony;

  const parts = [];

  if (locationClaims.length > 0) {
    const claim = locationClaims[0];
    parts.push(`I was at the ${claim.claimedLocation.replace('_', ' ')} earlier.`);
  }

  if (observations.length > 0) {
    const obs = observations[0];
    parts.push(`I saw ${obs.subjectName} near the ${obs.location.replace('_', ' ')}.`);
  }

  if (suspicions.length > 0) {
    const s = suspicions[0];
    parts.push(`If you ask me, ${s.targetName} ${s.reason}.`);
  }

  if (parts.length === 0) {
    parts.push(`I haven't noticed anything particularly suspicious, Inspector. Things seem quiet from where I stand.`);
  }

  return parts.join(' ');
}

export default function ConversationModal({ gameState, targetId, onClose, onLogConversation, onAlliance }) {
  const { characters, day, chunk } = gameState;
  const target = characters.find(c => c.id === targetId);

  const [monologue, setMonologue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allianceWarning, setAllianceWarning] = useState(false);

  if (!target) return null;

  // Fetch monologue once when modal opens
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchTestimony(target, gameState)
      .then(text => {
        if (!cancelled) {
          setMonologue(text);
          setLoading(false);
          if (onLogConversation) onLogConversation(targetId, text);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = buildFallbackMonologue(target);
          setMonologue(fallback);
          setLoading(false);
          if (onLogConversation) onLogConversation(targetId, fallback);
        }
      });
    return () => { cancelled = true; };
  }, [target.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProposeAlliance = () => {
    if (onAlliance) onAlliance(targetId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 shadow-2xl">

        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            <img
              src={`/images/characters/${target.id}.png`}
              alt={target.name}
              className="w-12 h-12 rounded-full border-2 border-amber-600 object-cover flex-shrink-0"
            />
            <div>
              <h2 className="text-amber-400 text-lg font-semibold">{target.name}</h2>
              <p className="text-slate-500 text-xs italic mt-0.5">{target.personality}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none ml-4"
            aria-label="Close conversation"
          >×</button>
        </div>

        {/* Monologue */}
        <div
          data-testid="character-response"
          className="bg-slate-800 rounded p-4 min-h-[100px] border border-slate-700 mb-5"
        >
          {loading ? (
            <p className="text-slate-400 text-sm italic animate-pulse">listening…</p>
          ) : (
            <p className="text-slate-200 text-sm leading-relaxed">"{monologue}"</p>
          )}
        </div>

        {/* Alliance warning */}
        {allianceWarning && (
          <div className="mb-4 p-3 rounded border border-purple-700 bg-purple-950/30 text-xs text-purple-300">
            This will reveal your identity as the Inspector. If they are mafia, the game is over.
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex gap-3 justify-between items-center">
          <button
            data-testid="propose-alliance-btn"
            onClick={() => {
              if (!allianceWarning) {
                setAllianceWarning(true);
              } else {
                handleProposeAlliance();
              }
            }}
            className="px-4 py-2 bg-purple-900/50 hover:bg-purple-800/60 border border-purple-700 text-purple-300 rounded transition-colors text-sm"
          >
            {allianceWarning ? 'Confirm Alliance' : 'Propose Alliance'}
          </button>
          <span className="text-slate-600 text-xs">
            {allianceWarning ? '⚠ reveals your identity' : ''}
          </span>
          <button
            data-testid="close-conversation"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded transition-colors text-sm"
          >
            Leave
          </button>
        </div>

        <div className="text-xs text-slate-700 text-right mt-3">
          Day {day}, Chunk {chunk}
        </div>
      </div>
    </div>
  );
}
