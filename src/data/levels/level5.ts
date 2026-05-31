import type { LevelConfig } from '../../core/types';

/** Level 5 — ♠♠♠♠♠ "Five Aces". Full chaos: five ships, twelve docks, gnarly cargo. */
export const level5: LevelConfig = {
  index: 5,
  rank: '♠♠♠♠♠',
  name: 'Five Aces',
  durationMs: 600_000,
  threshold: 17000, // ~0.72× a careful run (~23.5k) — the dispatcher-bound finale; brisk play required
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
    maxConcurrent: 8,
    expiryMs: [20_000, 38_000],
    itemsPerRequest: [4, 6],
    shapeTiers: [3, 4],
    valuePerCell: [30, 46],
  },
  seed: 555,
};
