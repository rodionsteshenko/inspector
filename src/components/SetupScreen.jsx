import { useState } from 'react';
import { ROLES, ROLE_DESCRIPTIONS, PLAYER_COUNT_CONFIGS } from '../engine/roles.js';
import { MAP_LAYOUTS, MAP_LAYOUT_IDS, DEFAULT_MAP_LAYOUT } from '../engine/mapDefinitions.js';
import { CHUNKS_PER_DAY, BASE_CONVERSATIONS_PER_DAY } from '../engine/gameState.js';
import { getSavedGames, deleteSave } from '../engine/saveLoad.js';

// ── Map preview (renders any layout) ─────────────────────────────────────────

function MapPreview({ layout, selected, onClick }) {
  const { nodes, edges, nodePositions, svgViewBox } = layout;
  return (
    <button
      data-testid={`map-${layout.id}`}
      onClick={() => onClick(layout.id)}
      className={`rounded-lg border p-3 transition-colors cursor-pointer ${
        selected
          ? 'border-amber-600 bg-amber-950/30'
          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
      }`}
    >
      <svg viewBox={svgViewBox} className="w-full h-24">
        {edges.map(([a, b], i) => {
          const pa = nodePositions[a];
          const pb = nodePositions[b];
          if (!pa || !pb) return null;
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#334155" strokeWidth="2" />;
        })}
        {nodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          return (
            <g key={node.id}>
              <circle cx={pos.x} cy={pos.y} r={14}
                fill={selected ? '#1e293b' : '#0f172a'} stroke={selected ? '#d97706' : '#475569'} strokeWidth="1.5" />
              <text x={pos.x} y={pos.y + 3} textAnchor="middle" dominantBaseline="middle"
                fill="#94a3b8" fontSize="7">
                {node.name.length > 6 ? node.name.slice(0, 6) : node.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 text-center">
        <div className={`text-xs font-medium ${selected ? 'text-amber-400' : 'text-slate-400'}`}>
          {layout.name}
        </div>
        <div className="text-xs text-slate-600">{layout.description}</div>
      </div>
    </button>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ value, min, max, onChange, label, sublabel }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-slate-300 text-sm">{label}</span>
        {sublabel && <span className="text-slate-600 text-xs ml-2">{sublabel}</span>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-7 h-7 rounded border border-slate-600 text-slate-400 hover:border-slate-400 disabled:opacity-25 disabled:cursor-not-allowed text-lg leading-none flex items-center justify-center"
        >−</button>
        <span className="text-amber-400 text-sm w-6 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-7 h-7 rounded border border-slate-600 text-slate-400 hover:border-slate-400 disabled:opacity-25 disabled:cursor-not-allowed text-lg leading-none flex items-center justify-center"
        >+</button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultRoleCounts(playerCount) {
  const cfg = PLAYER_COUNT_CONFIGS[playerCount];
  if (!cfg) return { mafia: 2, doctor: 1, journalist: 0, mason: 0 };
  const pool = cfg.rolePool;
  return {
    mafia:      pool.filter(r => r === ROLES.MAFIA).length,
    doctor:     pool.filter(r => r === ROLES.DOCTOR).length,
    journalist: pool.filter(r => r === ROLES.JOURNALIST).length,
    mason:      pool.filter(r => r === ROLES.MASON).length,
  };
}

function getCitizenCount(npcCount, roleCounts) {
  const used = roleCounts.mafia + roleCounts.doctor + roleCounts.journalist + roleCounts.mason;
  return Math.max(0, npcCount - used);
}

function getBalanceLabel(mafiaCount, totalPlayers) {
  const ratio = mafiaCount / totalPlayers;
  if (ratio < 0.2)  return { label: 'Mafia outnumbered', color: 'text-blue-400' };
  if (ratio <= 0.25) return { label: 'Balanced', color: 'text-green-400' };
  if (ratio <= 0.33) return { label: 'Slightly mafia-favored', color: 'text-yellow-400' };
  return { label: 'Heavily mafia-favored', color: 'text-red-400' };
}

// ── Saved Games Panel ────────────────────────────────────────────────────────

function SavedGamesPanel({ onLoadGame }) {
  const [saves, setSaves] = useState(() => getSavedGames());
  const [expanded, setExpanded] = useState(false);

  if (saves.length === 0) return null;

  const handleDelete = (id) => {
    deleteSave(id);
    setSaves(getSavedGames());
  };

  const displaySaves = expanded ? saves : saves.slice(0, 3);

  return (
    <div className="w-full max-w-4xl mt-6">
      <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">Saved Games</div>
      <div className="bg-slate-900 rounded-lg border border-slate-800 divide-y divide-slate-800">
        {displaySaves.map(save => (
          <div key={save.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-slate-300 text-sm">{save.name}</div>
              <div className="text-slate-600 text-xs">
                {new Date(save.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                data-testid={`load-save-${save.id}`}
                onClick={() => onLoadGame(save.id)}
                className="px-3 py-1 text-xs bg-amber-900/40 hover:bg-amber-800/40 border border-amber-700/50 text-amber-400 rounded transition-colors"
              >
                Load
              </button>
              <button
                onClick={() => handleDelete(save.id)}
                className="px-2 py-1 text-xs bg-slate-800 hover:bg-red-900/30 border border-slate-700 text-slate-500 hover:text-red-400 rounded transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      {saves.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-600 text-xs mt-1 hover:text-slate-400 transition-colors"
        >
          {expanded ? 'Show less' : `Show all (${saves.length})`}
        </button>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const PLAYER_COUNTS = [6, 8, 10, 12];

export default function SetupScreen({ onStartGame, onLoadGame }) {
  const [playerCount, setPlayerCount] = useState(8);
  const [conversations, setConversations] = useState(BASE_CONVERSATIONS_PER_DAY);
  const [chunks, setChunks] = useState(CHUNKS_PER_DAY);
  const [roleCounts, setRoleCounts] = useState(getDefaultRoleCounts(8));
  const [mapLayout, setMapLayout] = useState(DEFAULT_MAP_LAYOUT);

  const npcCount = PLAYER_COUNT_CONFIGS[playerCount]?.npcCount ?? playerCount - 1;
  const citizens = getCitizenCount(npcCount, roleCounts);
  const specialUsed = roleCounts.mafia + roleCounts.doctor + roleCounts.journalist + roleCounts.mason;
  const roleMax = (current) => npcCount - (specialUsed - current);

  function handlePlayerCountChange(n) {
    setPlayerCount(n);
    setRoleCounts(getDefaultRoleCounts(n));
  }

  function setRole(role, value) {
    setRoleCounts(prev => {
      const next = { ...prev, [role]: value };
      const used = next.mafia + next.doctor + next.journalist + next.mason;
      if (used > npcCount) return prev;
      return next;
    });
  }

  const balance = getBalanceLabel(roleCounts.mafia, playerCount);

  function handleStart() {
    onStartGame({ playerCount, conversationsPerDay: conversations, chunksPerDay: chunks, roleCounts, mapLayout });
  }

  return (
    <div data-testid="setup-screen"
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-start px-6 py-8 overflow-y-auto">

      <div className="text-center mb-8">
        <h1 className="text-4xl font-serif text-amber-400 mb-2">Constantine the Constable</h1>
        <p className="text-slate-500 text-sm">A village hides its secrets. Two killers walk among them.</p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left column */}
        <div className="flex flex-col gap-6">

          {/* Map selector */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Map</div>
            <div className="grid grid-cols-3 gap-3">
              {MAP_LAYOUT_IDS.map(id => (
                <MapPreview
                  key={id}
                  layout={MAP_LAYOUTS[id]}
                  selected={mapLayout === id}
                  onClick={setMapLayout}
                />
              ))}
            </div>
          </div>

          {/* Player count */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Players</div>
            <div className="flex gap-2">
              {PLAYER_COUNTS.map(n => (
                <button key={n} data-testid={`player-count-${n}`}
                  onClick={() => handlePlayerCountChange(n)}
                  className={`flex-1 py-2 rounded border text-sm transition-colors ${
                    playerCount === n
                      ? 'border-amber-600 bg-amber-950/40 text-amber-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">

          {/* Gameplay settings */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Gameplay</div>
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 divide-y divide-slate-800">
              <Stepper
                label="Conversations per day"
                value={conversations} min={1} max={6}
                onChange={setConversations}
              />
              <Stepper
                label="Time chunks per day"
                sublabel="(each action costs 1)"
                value={chunks} min={4} max={12}
                onChange={setChunks}
              />
            </div>
          </div>

          {/* Role composition */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Role Composition</div>
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 divide-y divide-slate-800">
              <Stepper
                label="Mafia" sublabel={ROLE_DESCRIPTIONS[ROLES.MAFIA]}
                value={roleCounts.mafia} min={1} max={roleMax(roleCounts.mafia)}
                onChange={v => setRole('mafia', v)}
              />
              <Stepper
                label="Doctor" sublabel={ROLE_DESCRIPTIONS[ROLES.DOCTOR]}
                value={roleCounts.doctor} min={0} max={Math.min(2, roleMax(roleCounts.doctor))}
                onChange={v => setRole('doctor', v)}
              />
              <Stepper
                label="Journalist" sublabel={ROLE_DESCRIPTIONS[ROLES.JOURNALIST]}
                value={roleCounts.journalist} min={0} max={Math.min(2, roleMax(roleCounts.journalist))}
                onChange={v => setRole('journalist', v)}
              />
              <Stepper
                label="Mason" sublabel={ROLE_DESCRIPTIONS[ROLES.MASON]}
                value={roleCounts.mason} min={0} max={Math.min(2, roleMax(roleCounts.mason))}
                onChange={v => setRole('mason', v)}
              />
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 text-sm">Citizens</span>
                <span className="text-slate-500 text-sm tabular-nums w-6 text-center">{citizens}</span>
              </div>
            </div>
            <div className="mt-2 text-xs">
              <span className="text-slate-600">Balance: </span>
              <span className={balance.color}>{balance.label}</span>
              <span className="text-slate-600"> — {roleCounts.mafia} mafia / {playerCount} players</span>
            </div>
          </div>

        </div>
      </div>

      {/* Start button */}
      <div className="mt-8 text-center">
        <button data-testid="start-game-btn" onClick={handleStart}
          className="px-10 py-4 bg-amber-800/60 hover:bg-amber-700/60 border border-amber-700 text-amber-300 text-lg rounded-lg transition-colors font-serif tracking-wide"
        >
          Begin Investigation
        </button>
        <p className="text-slate-700 text-xs mt-2">Roles are randomized each game</p>
      </div>

      {/* Saved games */}
      {onLoadGame && <SavedGamesPanel onLoadGame={onLoadGame} />}
    </div>
  );
}
