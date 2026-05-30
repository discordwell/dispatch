/**
 * Throwaway balance harness: plays each level with the REAL game code under a realistic
 * multi-load dispatcher policy, at a few packing speeds. One dispatcher acts serially —
 * while packing one ship the clock runs and the rest of the fleet waits. Prints achievable
 * earnings so thresholds can be set as a fraction of a good player's take. Run with vite-node.
 */
import { createGameState } from './src/core/setup';
import { step } from './src/core/sim';
import { beginLoad, commitLoad, cancelLoad, idleShips } from './src/state/actions';
import { autoPack } from './src/core/autopack';
import { getLevel } from './src/data/levels';
import type { GameState, PolyominoItem } from './src/core/types';

const density = (it: PolyominoItem): number => it.value / it.cells.length;

/** Items of every active order at a dock, best value-density first (greedy pack order). */
function dockItems(s: GameState, dockId: string): PolyominoItem[] {
  return s.requests
    .filter((r) => r.status === 'active' && r.originId === dockId && r.destId !== r.originId)
    .flatMap((r) => r.items)
    .slice()
    .sort((a, b) => density(b) - density(a));
}

function dockValues(s: GameState): Map<string, number> {
  const v = new Map<string, number>();
  for (const r of s.requests) {
    if (r.status === 'active' && r.destId !== r.originId) {
      v.set(r.originId, (v.get(r.originId) ?? 0) + r.baseReward);
    }
  }
  return v;
}

function play(levelIndex: number, perItemMs: number, overheadMs: number, maxItems: number): number {
  const s = createGameState(levelIndex);
  let pending: { shipId: string; doneAt: number } | null = null;
  let guard = 0;
  const pick = (s2: GameState, dock: string): PolyominoItem[] => dockItems(s2, dock).slice(0, maxItems);
  while (s.outcome === 'playing' && guard++ < 2_000_000) {
    // finish the pack the dispatcher is working on → dispatch a milk-run with whatever's still there
    if (pending && s.clockMs >= pending.doneAt) {
      const ship = s.ships.find((sh) => sh.id === pending!.shipId);
      const dock = ship?.loadingDockId;
      let dispatched = false;
      if (ship && dock) {
        const placements = autoPack(ship.holdW, ship.holdH, pick(s, dock));
        if (placements.length) dispatched = commitLoad(s, ship.id, placements);
      }
      if (!dispatched && ship) cancelLoad(s, ship.id);
      pending = null;
    }

    // start a new pack if the dispatcher is free and a ship is idle
    if (!pending) {
      const ship = idleShips(s).find((sh) => sh.owned);
      if (ship) {
        const val = dockValues(s);
        let dock: string | null = null;
        if (ship.locationId && val.has(ship.locationId)) dock = ship.locationId; // no deadhead
        else {
          let best = -1;
          for (const [d, v] of val) if (v > best) { best = v; dock = d; }
        }
        if (dock && beginLoad(s, dock, ship.id)) {
          const placements = autoPack(ship.holdW, ship.holdH, pick(s, dock));
          if (placements.length === 0) cancelLoad(s, ship.id);
          else pending = { shipId: ship.id, doneAt: s.clockMs + overheadMs + perItemMs * placements.length };
        }
      }
    }
    step(s, 100);
  }
  return Math.round(s.earnings);
}

// A player picks a sensible load size; take the best over a small grid of caps per speed tier.
const CAPS = [3, 4, 5, 6, 8, 99];
const best = (lvl: number, pi: number, oh: number): number => Math.max(...CAPS.map((m) => play(lvl, pi, oh, m)));
const settings: [number, number, string][] = [
  [1400, 1600, 'fast'],
  [2400, 2000, 'mid'],
  [3400, 2400, 'careful'],
];
for (let lvl = 1; lvl <= 5; lvl++) {
  const cfg = getLevel(lvl);
  const parts = settings.map(([pi, oh, name]) => `${name}=${String(best(lvl, pi, oh)).padStart(6)}`).join('  ');
  // eslint-disable-next-line no-console
  console.log(`L${lvl} ${cfg.rank.padEnd(5)} threshold=${String(cfg.threshold).padStart(6)}   ${parts}`);
}
