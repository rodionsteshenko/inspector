import { useState } from 'react';
import { ROLES, ROLE_DESCRIPTIONS, PLAYER_COUNT_CONFIGS } from '../engine/roles.js';
import { MAP_NODES, MAP_EDGES } from '../engine/map.js';

// Mini SVG map for the setup screen preview
const NODE_POSITIONS = {
  town_square: { x: 200, y: 150 },
  church:      { x: 200, y: 50 },
  docks:       { x: 80,  y: 150 },
  market:      { x: 320, y: 150 },
  tavern:      { x: 200, y: 260 },
  library:     { x: 320, y: 260 },
  alley:       { x: 200, y: 350 },
  cellar:      { x: 200, y: 430 },
};

function MapPreview() {
  return (
    <svg viewBox="0 0 400 490" className="w-full h-full" data-testid="setup-map-preview">
      {/* Edges */}
      {MAP_EDGES.map(([a, b], i) => {
        const pa = NODE_POSITIONS[a];
        const pb = NODE_POSITIONS[b];
        if (!pa || !pb) return null;
        return (
          <line
            key={i}
            x1={pa.x} y1={pa.y}
            x2={pb.x} y2={pb.y}
            stroke="#334155" strokeWidth="2"
          />
        );
      })}
      {/* Nodes */}
      {MAP_NODES.map(node => {
        const pos = NODE_POSITIONS[node.id];
        if (!pos) return null;
        return (
          <g key={node.id}>
            <circle cx={pos.x} cy={pos.y} r={18}
              fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
              className="text-xs" fill="#94a3b8" fontSize="9">
              {node.name.replace(' ', '\n')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const ROLE_ICONS = {
  [ROLES.INSPECTOR]: '🔍',
  [ROLES.MAFIA]: '🗡',
  [ROLES.DOCTOR]: '⚕',
  [ROLES.MASON]: '🔨',
  [ROLES.JOURNALIST]: '📜',
  [ROLES.CITIZEN]: '👤',
};

const ROLE_COLORS = {
  [ROLES.INSPECTOR]: 'border-amber-600 bg-amber-950/30',
  [ROLES.MAFIA]: 'border-red-700 bg-red-950/30',
  [ROLES.DOCTOR]: 'border-green-700 bg-green-950/30',
  [ROLES.MASON]: 'border-purple-700 bg-purple-950/30',
  [ROLES.JOURNALIST]: 'border-blue-700 bg-blue-950/30',
  [ROLES.CITIZEN]: 'border-slate-700 bg-slate-900/50',
};

function countRolesInConfig(playerCount) {
  const cfg = PLAYER_COUNT_CONFIGS[playerCount];
  if (!cfg) return {};
  const counts = {};
  for (const role of cfg.rolePool) {
    counts[role] = (counts[role] || 0) + 1;
  }
  counts[ROLES.INSPECTOR] = 1;
  return counts;
}

function getBalanceIndicator(playerCount) {
  const counts = countRolesInConfig(playerCount);
  const mafiaCount = counts[ROLES.MAFIA] || 0;
  const totalCount = playerCount;
  const ratio = mafiaCount / totalCount;
  if (ratio <= 0.22) return { label: 'Balanced', color: 'text-green-400', bg: 'bg-green-950/40 border-green-800' };
  if (ratio <= 0.28) return { label: 'Slightly Mafia-Favored', color: 'text-yellow-400', bg: 'bg-yellow-950/40 border-yellow-800' };
  return { label: 'Unbalanced', color: 'text-red-400', bg: 'bg-red-950/40 border-red-800' };
}

export default function SetupScreen({ onStartGame }) {
  const [playerCount, setPlayerCount] = useState(8);
  const [maxDays, setMaxDays] = useState(5);
  const [conversationsPerDay, setConversationsPerDay] = useState(3);
  const playerCounts = [6, 8, 10, 12];
  const dayOptions = [3, 5, 7];
  const convOptions = [2, 3, 4];
  const roleCounts = countRolesInConfig(playerCount);
  const balance = getBalanceIndicator(playerCount);

  const allRoles = [
    ROLES.INSPECTOR,
    ROLES.MAFIA,
    ROLES.DOCTOR,
    ROLES.MASON,
    ROLES.JOURNALIST,
    ROLES.CITIZEN,
  ];

  return (
    <div data-testid="setup-screen"
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-start px-6 py-8 overflow-y-auto">

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-serif text-amber-400 mb-2">The Inspector</h1>
        <p className="text-slate-500 text-sm">
          A village hides its secrets. Two killers walk among them.
        </p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left: Map Preview */}
        <div className="flex flex-col">
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Ashenmoor</div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 flex-1 min-h-64">
            <MapPreview />
          </div>
          <p className="text-slate-600 text-xs mt-2 text-center">
            8 locations • adjacency-based movement • every path is evidence
          </p>
        </div>

        {/* Right: Configuration */}
        <div className="flex flex-col gap-5">

          {/* Player Count */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
              Player Count
            </div>
            <div className="flex gap-2">
              {playerCounts.map(n => (
                <button
                  key={n}
                  data-testid={`player-count-${n}`}
                  onClick={() => setPlayerCount(n)}
                  className={`flex-1 py-2 rounded border text-sm transition-colors ${
                    playerCount === n
                      ? 'border-amber-600 bg-amber-950/40 text-amber-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Game Length */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
              Game Length
            </div>
            <div className="flex gap-2">
              {dayOptions.map(n => (
                <button
                  key={n}
                  data-testid={`max-days-${n}`}
                  onClick={() => setMaxDays(n)}
                  className={`flex-1 py-2 rounded border text-sm transition-colors ${
                    maxDays === n
                      ? 'border-amber-600 bg-amber-950/40 text-amber-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {n} days
                </button>
              ))}
            </div>
          </div>

          {/* Conversations per Day */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
              Conversations per Day
            </div>
            <div className="flex gap-2">
              {convOptions.map(n => (
                <button
                  key={n}
                  data-testid={`conv-per-day-${n}`}
                  onClick={() => setConversationsPerDay(n)}
                  className={`flex-1 py-2 rounded border text-sm transition-colors ${
                    conversationsPerDay === n
                      ? 'border-amber-600 bg-amber-950/40 text-amber-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Balance Indicator */}
          <div className={`px-3 py-2 rounded border text-xs ${balance.bg}`}>
            <span className="text-slate-500">Balance: </span>
            <span className={balance.color}>{balance.label}</span>
            <span className="text-slate-600"> — {playerCount} players, {(roleCounts[ROLES.MAFIA] || 0)} mafia</span>
          </div>

          {/* Role Cards */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
              Role Composition
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map(role => {
                const count = roleCounts[role] || 0;
                if (count === 0) return null;
                return (
                  <div
                    key={role}
                    data-testid={`role-card-${role}`}
                    className={`p-3 rounded border ${ROLE_COLORS[role]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-200 text-sm font-medium capitalize">{role}</span>
                      <span className="text-slate-400 text-xs">×{count}</span>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended Preset */}
          <div className="text-center">
            <span className="text-slate-600 text-xs">
              Preset: Balanced {playerCount}-player game with every mechanic represented
            </span>
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div className="mt-8 text-center">
        <button
          data-testid="start-game-btn"
          onClick={() => onStartGame({ playerCount, maxDays, conversationsPerDay })}
          className="px-10 py-4 bg-amber-800/60 hover:bg-amber-700/60 border border-amber-700 text-amber-300 text-lg rounded-lg transition-colors font-serif tracking-wide"
        >
          Begin Investigation
        </button>
        <p className="text-slate-700 text-xs mt-2">Roles are randomized each game</p>
      </div>
    </div>
  );
}
