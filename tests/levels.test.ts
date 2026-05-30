import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { createGameState } from '../src/core/setup';
import { cityExists } from '../src/data/cities';
import { SHIP_CLASSES } from '../src/data/ships';
import { getShapesForTiers } from '../src/data/shapes';
import { step } from '../src/core/sim';
import { activeRequests, autoAssign, idleShips } from '../src/state/actions';

/**
 * Greedy reference policy with the real bottleneck: the dispatcher packs ONE ship at a
 * time, and a pack costs overhead + perItem·items. Charters unused → a conservative lower
 * bound on what a deliberate human can bank. Defaults model careful play.
 */
function playGated(idx: number, perItem = 3600, overhead = 2200): number {
  const s = createGameState(idx);
  let free = 0;
  let guard = 0;
  while (s.outcome === 'playing' && guard++ < 400_000) {
    if (s.clockMs >= free) {
      const idle = idleShips(s).filter((sh) => sh.owned);
      const active = activeRequests(s).sort((a, b) => b.baseReward - a.baseReward);
      if (idle[0] && active[0] && autoAssign(s, active[0].id, idle[0].id)) {
        free = s.clockMs + overhead + perItem * active[0].items.length;
      }
    }
    step(s, 100);
  }
  return s.earnings;
}

describe('levels', () => {
  it('every level config is internally valid', () => {
    for (const lvl of LEVELS) {
      expect(lvl.durationMs).toBeGreaterThan(0);
      expect(lvl.threshold).toBeGreaterThan(0);
      expect(lvl.cityIds.length).toBeGreaterThanOrEqual(2);
      for (const id of lvl.cityIds) expect(cityExists(id)).toBe(true);
      expect(lvl.ownedShips.length).toBeGreaterThan(0);
      for (const o of lvl.ownedShips) expect(SHIP_CLASSES[o.shipClass]).toBeDefined();
      expect(() => getShapesForTiers(lvl.spawn.shapeTiers)).not.toThrow();
      expect(lvl.spawn.intervalMs[0]).toBeLessThanOrEqual(lvl.spawn.intervalMs[1]);
      expect(lvl.spawn.expiryMs[0]).toBeLessThanOrEqual(lvl.spawn.expiryMs[1]);
      expect(lvl.spawn.itemsPerRequest[0]).toBeLessThanOrEqual(lvl.spawn.itemsPerRequest[1]);
    }
  });

  it('ranks escalate one ace per level', () => {
    LEVELS.forEach((lvl, i) => {
      expect(lvl.index).toBe(i + 1);
      expect(lvl.rank).toBe('♠'.repeat(i + 1));
    });
  });

  it('every level is winnable at a deliberate (packing-time-gated) pace', () => {
    for (const lvl of LEVELS) {
      const banked = playGated(lvl.index);
      expect(banked, `level ${lvl.index} careful earnings ${banked} vs threshold ${lvl.threshold}`).toBeGreaterThanOrEqual(lvl.threshold);
    }
  });

  it('every level is lost by doing nothing', () => {
    for (const lvl of LEVELS) {
      const idle = createGameState(lvl.index);
      while (idle.outcome === 'playing') step(idle, 1000);
      expect(idle.earnings).toBe(0);
      expect(idle.outcome).toBe('lost');
    }
  });
});
