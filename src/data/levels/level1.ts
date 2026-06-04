import type { LevelConfig } from '../../core/types';

/**
 * Level 1 — ♠ "The Morning Mail". Tutorialish: one Hauler, eight docks, gentle
 * shapes (tiers 1–2), generous expiries, a forgiving threshold. The concrete,
 * tuned level; 2–5 escalate purely via data.
 */
export const level1: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'The Morning Mail',
  durationMs: 120_000, // 2-minute shift
  threshold: 700, // ~0.57× a careful 2-min run (~1.2k); gentle ace-1 goal. See measure-balance.ts.
  shipSpeed: 30,
  cityIds: [
    'loading-bay',
    'tenement-junction',
    'market-cross',
    'highgate-terrace',
    'clocktower-plaza',
    'garrison-keep',
    'cog-junction',
    'aether-pier',
  ],
  ownedShips: [{ shipClass: 'Hauler' }],
  npc: { enabled: true, spawnDistance: 150 },
  spawn: {
    firstAtMs: 4_000,
    intervalMs: [9_000, 16_000],
    maxConcurrent: 6, // raised with the longer expiry so the board stays stocked to batch from
    expiryMs: [70_000, 110_000], // long enough to hold several orders and batch them, yet can still lapse before the bell
    itemsPerRequest: [2, 4],
    shapeTiers: [1, 2],
    valuePerCell: [22, 34],
  },
  seed: 1337,
};
