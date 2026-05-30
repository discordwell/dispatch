import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { createGameState } from '../src/core/setup';
import { cityExists } from '../src/data/cities';
import { SHIP_CLASSES } from '../src/data/ships';
import { getShapesForTiers } from '../src/data/shapes';
import { step } from '../src/core/sim';
import { autoPack } from '../src/core/autopack';
import { beginLoad, cancelLoad, commitLoad, idleShips } from '../src/state/actions';
import type { PolyominoItem } from '../src/core/types';

/**
 * Multi-load reference policy with the real bottleneck: one dispatcher packs one ship at a
 * time (a pack costs overhead + perItem·items), loading several orders from a dock into one
 * milk-run and auto-unloading at each stop. Charters unused → a conservative lower bound on a
 * deliberate human's take. `maxItems` caps how much is packed per dispatch (a player keeps the
 * fleet cycling rather than over-packing one ship). Mirrors `measure-balance.ts`.
 */
function playGatedCapped(idx: number, perItem: number, overhead: number, maxItems: number): number {
  const s = createGameState(idx);
  const dockItems = (dock: string): PolyominoItem[] =>
    s.requests
      .filter((r) => r.status === 'active' && r.originId === dock && r.destId !== r.originId)
      .flatMap((r) => r.items)
      .slice()
      .sort((a, b) => b.value / b.cells.length - a.value / a.cells.length)
      .slice(0, maxItems);
  let pending: { shipId: string; doneAt: number } | null = null;
  let guard = 0;
  while (s.outcome === 'playing' && guard++ < 400_000) {
    if (pending && s.clockMs >= pending.doneAt) {
      const ship = s.ships.find((sh) => sh.id === pending!.shipId);
      const dock = ship?.loadingDockId;
      let done = false;
      if (ship && dock) {
        const placements = autoPack(ship.holdW, ship.holdH, dockItems(dock));
        if (placements.length) done = commitLoad(s, ship.id, placements);
      }
      if (!done && ship) cancelLoad(s, ship.id);
      pending = null;
    }
    if (!pending) {
      const ship = idleShips(s).find((sh) => sh.owned);
      if (ship) {
        const val = new Map<string, number>();
        for (const r of s.requests) {
          if (r.status === 'active' && r.destId !== r.originId) {
            val.set(r.originId, (val.get(r.originId) ?? 0) + r.baseReward);
          }
        }
        let dock: string | null = null;
        if (ship.locationId && val.has(ship.locationId)) dock = ship.locationId; // no deadhead
        else {
          let best = -1;
          for (const [d, v] of val) if (v > best) { best = v; dock = d; }
        }
        if (dock && beginLoad(s, dock, ship.id)) {
          const placements = autoPack(ship.holdW, ship.holdH, dockItems(dock));
          if (placements.length === 0) cancelLoad(s, ship.id);
          else pending = { shipId: ship.id, doneAt: s.clockMs + overhead + perItem * placements.length };
        }
      }
    }
    step(s, 100);
  }
  return s.earnings;
}

/** What a careful player manages, choosing a sensible load size (best over a few caps). */
function playCareful(idx: number): number {
  return Math.max(...[4, 6, 8].map((m) => playGatedCapped(idx, 3400, 2400, m)));
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

  it('every level is winnable at a careful, multi-load pace (with margin to spare)', () => {
    for (const lvl of LEVELS) {
      const banked = playCareful(lvl.index);
      expect(
        banked,
        `level ${lvl.index} careful earnings ${banked} vs threshold ${lvl.threshold}`,
      ).toBeGreaterThanOrEqual(lvl.threshold);
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
