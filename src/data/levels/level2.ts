import type { LevelConfig } from '../../core/types';

/** Level 2 — ♠♠ "Two Winds". Two ships; first taste of tier-3 shapes. (Stub — tune in playtest.) */
export const level2: LevelConfig = {
  index: 2,
  rank: '♠♠',
  name: 'Two Winds',
  durationMs: 180_000, // 3-minute shift
  threshold: 1900, // ~0.58× a careful 3-min run (~3.3k)
  shipSpeed: 27,
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
  ],
  ownedShips: [{ shipClass: 'Hauler' }, { shipClass: 'Scout' }],
  npc: { enabled: true, spawnDistance: 160 },
  spawn: {
    firstAtMs: 4_000,
    intervalMs: [8_000, 14_000],
    maxConcurrent: 7,
    expiryMs: [75_000, 125_000],
    itemsPerRequest: [2, 5],
    shapeTiers: [1, 2, 3],
    valuePerCell: [24, 36],
  },
  seed: 2024,
};
