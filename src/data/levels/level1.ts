import type { LevelConfig } from '../../core/types';

/**
 * Level 1 — ♠ "The Morning Mail". Tutorialish: one Hauler, eight cities, gentle
 * shapes (tiers 1–2), generous expiries, a forgiving threshold. The concrete,
 * tuned level; 2–5 escalate purely via data.
 */
export const level1: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'The Morning Mail',
  durationMs: 600_000,
  threshold: 3500, // ~30% of perfect-play; tune against real (human-paced) playtests
  cityIds: [
    'zybourne',
    'clockhaven',
    'tickmoor',
    'nimbus-wharf',
    'aetherhaven',
    'brassholm',
    'cogsworth',
    'gearford',
  ],
  ownedShips: [{ shipClass: 'Hauler' }],
  npc: { enabled: true, feeFraction: 0.3, spawnDistance: 150 },
  spawn: {
    firstAtMs: 4_000,
    intervalMs: [9_000, 16_000],
    maxConcurrent: 4,
    expiryMs: [45_000, 75_000],
    itemsPerRequest: [2, 4],
    shapeTiers: [1, 2],
    valuePerCell: [22, 34],
  },
  seed: 1337,
};
