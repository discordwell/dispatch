import type { LevelConfig } from '../../core/types';

/** Level 5 — ♠♠♠♠♠ "Five Aces". Full chaos: five ships, twelve docks, gnarly cargo. */
export const level5: LevelConfig = {
  index: 5,
  rank: '♠♠♠♠♠',
  name: 'Five Aces',
  durationMs: 360_000, // 6-minute shift
  threshold: 10500, // ~0.60× a careful 6-min run (~17.6k) — the dispatcher-bound finale; brisk play required
  shipSpeed: 18,
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
    'tinkers-end',
  ],
  ownedShips: [
    { shipClass: 'Hauler' },
    { shipClass: 'Scout' },
    { shipClass: 'Leviathan' },
    { shipClass: 'Hauler' },
    { shipClass: 'Leviathan' },
  ],
  npc: { enabled: true, spawnDistance: 210 },
  spawn: {
    firstAtMs: 2_500,
    intervalMs: [4_000, 7_000],
    maxConcurrent: 10,
    expiryMs: [65_000, 110_000],
    itemsPerRequest: [4, 6],
    shapeTiers: [3, 4],
    valuePerCell: [30, 46],
  },
  seed: 555,
};
