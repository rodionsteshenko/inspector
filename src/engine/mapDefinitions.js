// Three selectable map layouts: small (4), medium (5), large (6)

export const MAP_LAYOUTS = {
  small: {
    id: 'small',
    name: 'Hamlet',
    description: '4 locations — tight, intense',
    nodes: [
      { id: 'church', name: 'Church', capacity: 5, visibility: 'public', description: 'A quiet place for prayer and reflection.' },
      { id: 'docks', name: 'Docks', capacity: 5, visibility: 'public', description: 'Where fishermen and traders gather.' },
      { id: 'tavern', name: 'Tavern', capacity: 5, visibility: 'public', description: 'Where gossip flows like ale.' },
      { id: 'market', name: 'Market', capacity: 6, visibility: 'public', description: 'Bustling stalls and trading.' },
    ],
    edges: [
      ['church', 'docks'],
      ['docks', 'market'],
      ['market', 'tavern'],
      ['tavern', 'church'],
    ],
    nodePositions: {
      church: { x: 150, y: 100 },
      docks:  { x: 450, y: 100 },
      tavern: { x: 150, y: 320 },
      market: { x: 450, y: 320 },
    },
    svgViewBox: '0 0 600 440',
  },

  medium: {
    id: 'medium',
    name: 'Village',
    description: '5 locations — balanced',
    nodes: [
      { id: 'church', name: 'Church', capacity: 4, visibility: 'public', description: 'A quiet place for prayer and reflection.' },
      { id: 'docks', name: 'Docks', capacity: 4, visibility: 'public', description: 'Where fishermen and traders gather.' },
      { id: 'town_square', name: 'Town Square', capacity: 6, visibility: 'public', description: 'The busy center of village life.' },
      { id: 'market', name: 'Market', capacity: 5, visibility: 'public', description: 'Bustling stalls and trading.' },
      { id: 'tavern', name: 'Tavern', capacity: 4, visibility: 'public', description: 'Where gossip flows like ale.' },
    ],
    edges: [
      ['church', 'docks'],
      ['church', 'town_square'],
      ['docks', 'market'],
      ['docks', 'town_square'],
      ['market', 'tavern'],
      ['tavern', 'town_square'],
    ],
    nodePositions: {
      church:      { x: 150, y: 80 },
      docks:       { x: 450, y: 80 },
      town_square: { x: 300, y: 210 },
      market:      { x: 450, y: 340 },
      tavern:      { x: 150, y: 340 },
    },
    svgViewBox: '0 0 600 440',
  },

  large: {
    id: 'large',
    name: 'Town',
    description: '6 locations — room to hide',
    nodes: [
      { id: 'church', name: 'Church', capacity: 4, visibility: 'public', description: 'A quiet place for prayer and reflection.' },
      { id: 'docks', name: 'Docks', capacity: 4, visibility: 'public', description: 'Where fishermen and traders gather.' },
      { id: 'town_square', name: 'Town Square', capacity: 6, visibility: 'public', description: 'The busy center of village life.' },
      { id: 'market', name: 'Market', capacity: 5, visibility: 'public', description: 'Bustling stalls and trading.' },
      { id: 'tavern', name: 'Tavern', capacity: 4, visibility: 'public', description: 'Where gossip flows like ale.' },
      { id: 'library', name: 'Library', capacity: 3, visibility: 'public', description: 'Quiet study and old records.' },
    ],
    edges: [
      ['church', 'docks'],
      ['church', 'town_square'],
      ['docks', 'market'],
      ['town_square', 'market'],
      ['town_square', 'tavern'],
      ['market', 'library'],
      ['tavern', 'library'],
    ],
    nodePositions: {
      church:      { x: 150, y: 80 },
      docks:       { x: 450, y: 80 },
      town_square: { x: 150, y: 230 },
      market:      { x: 450, y: 230 },
      tavern:      { x: 150, y: 380 },
      library:     { x: 450, y: 380 },
    },
    svgViewBox: '0 0 600 480',
  },
};

export const MAP_LAYOUT_IDS = Object.keys(MAP_LAYOUTS);
export const DEFAULT_MAP_LAYOUT = 'medium';
