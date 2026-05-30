import { describe, it, expect } from 'vitest';
import { LEVELS, getLevel } from '../src/data/levels';
import { createGameState } from '../src/core/setup';
import { cityExists } from '../src/data/cities';
import { SHIP_CLASSES } from '../src/data/ships';
import { getShapesForTiers } from '../src/data/shapes';
import { step } from '../src/core/sim';
import { activeRequests, autoAssign, idleShips } from '../src/state/actions';
import type { GameState } from '../src/core/types';

/** Greedy reference policy: keep every idle ship busy on the best available request. */
function playGreedy(s: GameState): number {
  let guard = 0;
  while (s.outcome === 'playing' && guard++ < 200_000) {
    const idle = idleShips(s).filter((sh) => sh.owned);
    const active = activeRequests(s).sort((a, b) => b.baseReward - a.baseReward);
    let ai = 0;
    for (const ship of idle) {
      if (ai >= active.length) break;
      autoAssign(s, active[ai++]!.id, ship.id);
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

  it('level 1 is comfortably winnable by a greedy policy but not by doing nothing', () => {
    const greedy = playGreedy(createGameState(1));
    const threshold = getLevel(1).threshold;
    expect(greedy).toBeGreaterThanOrEqual(threshold);

    const idle = createGameState(1);
    while (idle.outcome === 'playing') step(idle, 1000);
    expect(idle.earnings).toBe(0);
    expect(idle.outcome).toBe('lost');
  });
});
