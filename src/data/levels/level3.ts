import type { LevelConfig } from '../../core/types';

/** Level 3 — ♠♠♠ "Brass Tempest". A Leviathan joins; tighter windows. (Stub — tune in playtest.) */
export const level3: LevelConfig = {
  index: 3,
  rank: '♠♠♠',
  name: 'Brass Tempest',
  durationMs: 600_000,
  threshold: 12000,
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
  ],
  ownedShips: [{ shipClass: 'Hauler' }, { shipClass: 'Scout' }, { shipClass: 'Leviathan' }],
  npc: { enabled: true, feeFraction: 0.26, spawnDistance: 175 },
  spawn: {
    firstAtMs: 3_500,
    intervalMs: [6_500, 11_000],
    maxConcurrent: 6,
    expiryMs: [32_000, 55_000],
    itemsPerRequest: [3, 5],
    shapeTiers: [2, 3],
    valuePerCell: [26, 40],
  },
  seed: 3003,
};
