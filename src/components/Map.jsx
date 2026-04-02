import { getAdjacentLocations, MAP_NODES, MAP_EDGES, ADJACENCY_MAP } from '../engine/map.js';

const NODE_RADIUS = 28;

export default function Map({ gameState, onMove }) {
  const { playerLocation, characters, phase, mapConfig } = gameState;
  const nodes = mapConfig?.nodes || MAP_NODES;
  const edges = mapConfig?.edges || MAP_EDGES;
  const positions = mapConfig?.nodePositions || {};
  const viewBox = mapConfig?.svgViewBox || '0 0 760 570';
  const adjacencyMap = mapConfig?.adjacencyMap || ADJACENCY_MAP;

  const adjacentLocations = getAdjacentLocations(playerLocation, adjacencyMap);
  const canMove = phase === 'day';

  // Group alive non-player characters by location
  const npcsByLocation = {};
  for (const node of nodes) {
    npcsByLocation[node.id] = characters.filter(
      c => c.alive && c.location === node.id && c.id !== 'player'
    );
  }

  const handleNodeClick = (nodeId) => {
    if (canMove && adjacentLocations.includes(nodeId)) {
      onMove(nodeId);
    }
  };

  return (
    <svg
      data-testid="map"
      viewBox={viewBox}
      className="w-full h-full"
      style={{ maxHeight: '100%' }}
    >
      {/* Dark parchment background */}
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#0d1520" />
          <stop offset="100%" stopColor="#060b12" />
        </radialGradient>
        {/* Clip paths for location images */}
        {nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          return (
            <clipPath key={`clip-${node.id}`} id={`clip-${node.id}`}>
              <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} />
            </clipPath>
          );
        })}
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGrad)" />

      {/* Edges / paths between locations */}
      {edges.map(([a, b], i) => {
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) return null;
        const isPlayerPath = (a === playerLocation || b === playerLocation) &&
          (adjacentLocations.includes(a) || adjacentLocations.includes(b));
        return (
          <line
            key={i}
            x1={pa.x} y1={pa.y}
            x2={pb.x} y2={pb.y}
            stroke={isPlayerPath && canMove ? '#1a3a2a' : '#162230'}
            strokeWidth="2"
            strokeDasharray={isPlayerPath && canMove ? 'none' : '4 4'}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions[node.id];
        if (!pos) return null;
        const isPlayerHere = node.id === playerLocation;
        const isAdjacent = adjacentLocations.includes(node.id);
        const isClickable = canMove && isAdjacent;
        const npcsHere = npcsByLocation[node.id] || [];

        let fillColor = '#0c1a2e';
        let strokeColor = '#1e3a5a';
        let strokeWidth = 1.5;
        let labelColor = '#64748b';

        if (isPlayerHere) {
          fillColor = '#3d1a04';
          strokeColor = '#d97706';
          strokeWidth = 2.5;
          labelColor = '#fbbf24';
        } else if (isClickable) {
          fillColor = '#0d2116';
          strokeColor = '#16a34a';
          strokeWidth = 2;
          labelColor = '#4ade80';
        }

        // NPC dot positions (up to 6 in a cluster)
        const dotOffsets = [
          { dx: -10, dy: -10 }, { dx: 10, dy: -10 },
          { dx: -10, dy:  10 }, { dx: 10, dy:  10 },
          { dx: 0,  dy: -14 }, { dx: 0,  dy:  14 },
        ];

        return (
          <g
            key={node.id}
            data-testid={`node-${node.id}`}
            onClick={() => handleNodeClick(node.id)}
            style={{ cursor: isClickable ? 'pointer' : 'default' }}
          >
            {/* Glow effect for adjacent nodes */}
            {isClickable && (
              <circle
                cx={pos.x} cy={pos.y} r={NODE_RADIUS + 8}
                fill="none"
                stroke="#16a34a"
                strokeWidth="1"
                opacity="0.3"
              />
            )}

            {/* Location image (clipped to circle) */}
            <image
              href={`/images/locations/${node.id}.png`}
              x={pos.x - NODE_RADIUS}
              y={pos.y - NODE_RADIUS}
              width={NODE_RADIUS * 2}
              height={NODE_RADIUS * 2}
              clipPath={`url(#clip-${node.id})`}
              preserveAspectRatio="xMidYMid slice"
              opacity={isPlayerHere ? 1 : isClickable ? 0.85 : 0.5}
            />

            {/* Node border circle */}
            <circle
              cx={pos.x} cy={pos.y}
              r={NODE_RADIUS}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />

            {/* Player indicator (star symbol) */}
            {isPlayerHere && (
              <text
                x={pos.x} y={pos.y + 5}
                textAnchor="middle"
                fill="#f59e0b"
                fontSize="14"
                fontFamily="serif"
              >
                ★
              </text>
            )}

            {/* NPC dots */}
            {!isPlayerHere && npcsHere.slice(0, 6).map((npc, i) => {
              const off = dotOffsets[i];
              return (
                <circle
                  key={npc.id}
                  cx={pos.x + off.dx}
                  cy={pos.y + off.dy}
                  r={4}
                  fill="#475569"
                />
              );
            })}
            {npcsHere.length > 6 && (
              <text x={pos.x + 20} y={pos.y - 18} fill="#64748b" fontSize="9">
                +{npcsHere.length - 6}
              </text>
            )}
            {/* Show NPC count if player is here */}
            {isPlayerHere && npcsHere.length > 0 && (
              <text x={pos.x + 18} y={pos.y - 20} fill="#94a3b8" fontSize="9">
                {npcsHere.length} here
              </text>
            )}

            {/* Location name label */}
            <text
              x={pos.x}
              y={pos.y + NODE_RADIUS + 16}
              textAnchor="middle"
              fill={labelColor}
              fontSize="11"
              fontFamily="Georgia, serif"
            >
              {node.name}
            </text>

            {/* "Move here" prompt for adjacent nodes */}
            {isClickable && (
              <text
                x={pos.x}
                y={pos.y + NODE_RADIUS + 28}
                textAnchor="middle"
                fill="#16a34a"
                fontSize="9"
                opacity="0.8"
              >
                click to move
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(10, 10)">
        <circle cx={8} cy={8} r={5} fill="#3d1a04" stroke="#d97706" strokeWidth="1.5" />
        <text x={17} y={12} fill="#94a3b8" fontSize="9">You</text>
        <circle cx={55} cy={8} r={5} fill="#0d2116" stroke="#16a34a" strokeWidth="1.5" />
        <text x={64} y={12} fill="#94a3b8" fontSize="9">Can move</text>
        <circle cx={118} cy={8} r={4} fill="#475569" />
        <text x={126} y={12} fill="#94a3b8" fontSize="9">Villager</text>
      </g>
    </svg>
  );
}
