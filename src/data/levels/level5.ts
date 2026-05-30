import type { LevelConfig } from '../../core/types';

/** Level 5 — ♠♠♠♠♠ "Five Aces". Full chaos: five ships, twelve cities, gnarly cargo. (Stub.) */
export const level5: LevelConfig = {
  index: 5,
  rank: '♠♠♠♠♠',
  name: 'Five Aces',
  durationMs: 600_000,
  threshold: 18_000,
  cityIds: [
    'zybourne',
    'clockhaven',
    'tickmoor',
    'nimbus-wharf',
    'aetherhaven',
    'brassholm',
    'cogsworth',
    'gearford',
    'sprocket-bay',
    'mainspring',
    'escapement',
    'fiveaces-landing',
  ],
  ownedShips: [
    { shipClass: 'Hauler' },
    { shipClass: 'Scout' },
    { shipClass: 'Leviathan' },
    { shipClass: 'Hauler' },
    { shipClass: 'Leviathan' },
  ],
  npc: { enabled: true, feeFraction: 0.22, spawnDistance: 210 },
  spawn: {
    firstAtMs: 2_500,
    intervalMs: [4_000, 7_000],
    maxConcurrent: 8,
    expiryMs: [20_000, 38_000],
    itemsPerRequest: [4, 6],
    shapeTiers: [3, 4],
    valuePerCell: [30, 46],
  },
  seed: 555,
};
