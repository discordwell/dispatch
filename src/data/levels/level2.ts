import type { LevelConfig } from '../../core/types';

/** Level 2 — ♠♠ "Two Winds". Two ships; first taste of tier-3 shapes. (Stub — tune in playtest.) */
export const level2: LevelConfig = {
  index: 2,
  rank: '♠♠',
  name: 'Two Winds',
  durationMs: 600_000,
  threshold: 7000,
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
  ],
  ownedShips: [{ shipClass: 'Hauler' }, { shipClass: 'Scout' }],
  npc: { enabled: true, feeFraction: 0.28, spawnDistance: 160 },
  spawn: {
    firstAtMs: 4_000,
    intervalMs: [8_000, 14_000],
    maxConcurrent: 5,
    expiryMs: [40_000, 65_000],
    itemsPerRequest: [2, 5],
    shapeTiers: [1, 2, 3],
    valuePerCell: [24, 36],
  },
  seed: 2024,
};
