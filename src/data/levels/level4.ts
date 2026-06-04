import type { LevelConfig } from '../../core/types';

/** Level 4 — ♠♠♠♠ "The Gauntlet". Four ships; tier-4 shapes appear. (Stub — tune in playtest.) */
export const level4: LevelConfig = {
  index: 4,
  rank: '♠♠♠♠',
  name: 'The Gauntlet',
  durationMs: 300_000, // 5-minute shift
  threshold: 7500, // ~0.59× a careful 5-min run (~12.6k)
  shipSpeed: 21,
  cityIds: [
    'loading-bay',
    'tenement-junction',
    'market-cross',
    'highgate-terrace',
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
  npc: { enabled: true, spawnDistance: 190 },
  spawn: {
    firstAtMs: 3_000,
    intervalMs: [5_000, 9_000],
    maxConcurrent: 9,
    expiryMs: [70_000, 120_000],
    itemsPerRequest: [3, 6],
    shapeTiers: [2, 3, 4],
    valuePerCell: [28, 42],
  },
  seed: 404,
};
