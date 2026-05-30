import type { LevelConfig } from '../../core/types';

/** Level 4 — ♠♠♠♠ "The Gauntlet". Four ships; tier-4 shapes appear. (Stub — tune in playtest.) */
export const level4: LevelConfig = {
  index: 4,
  rank: '♠♠♠♠',
  name: 'The Gauntlet',
  durationMs: 600_000,
  threshold: 15000,
  cityIds: [
    'loading-bay',
    'the-slums',
    'commercial-quay',
    'uptown-heights',
    'clocktower-plaza',
    'garrison-keep',
    'cog-junction',
    'aether-pier',
    'sprocket-row',
    'gearford-wall',
    'brass-gate',
  ],
  ownedShips: [
    { shipClass: 'Hauler' },
    { shipClass: 'Scout' },
    { shipClass: 'Leviathan' },
    { shipClass: 'Hauler' },
  ],
  npc: { enabled: true, feeFraction: 0.24, spawnDistance: 190 },
  spawn: {
    firstAtMs: 3_000,
    intervalMs: [5_000, 9_000],
    maxConcurrent: 7,
    expiryMs: [26_000, 46_000],
    itemsPerRequest: [3, 6],
    shapeTiers: [2, 3, 4],
    valuePerCell: [28, 42],
  },
  seed: 404,
};
