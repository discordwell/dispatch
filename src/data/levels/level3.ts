import type { LevelConfig } from '../../core/types';

/** Level 3 — ♠♠♠ "Brass Tempest". A Leviathan joins; tighter windows. (Stub — tune in playtest.) */
export const level3: LevelConfig = {
  index: 3,
  rank: '♠♠♠',
  name: 'Brass Tempest',
  durationMs: 240_000, // 4-minute shift
  threshold: 4500, // ~0.58× a careful 4-min run (~7.7k); demands a brisk pace
  shipSpeed: 24,
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
  ],
  ownedShips: [{ shipClass: 'Hauler' }, { shipClass: 'Scout' }, { shipClass: 'Leviathan' }],
  npc: { enabled: true, spawnDistance: 175 },
  spawn: {
    firstAtMs: 3_500,
    intervalMs: [6_500, 11_000],
    maxConcurrent: 8,
    expiryMs: [75_000, 130_000],
    itemsPerRequest: [3, 5],
    shapeTiers: [2, 3],
    valuePerCell: [26, 40],
  },
  seed: 3003,
};
