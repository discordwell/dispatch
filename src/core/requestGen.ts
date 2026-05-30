import { makeRng, randInt, randRange, pick } from './rng';
import { getShapesForTiers } from '../data/shapes';
import type { City, DeliveryRequest, LevelConfig, PolyominoItem } from './types';

/**
 * Precompute the whole shift's request schedule, deterministically from the level
 * seed. `maxConcurrent` is enforced against spawn/expire windows so the board never
 * exceeds it (assignment only ever frees slots earlier at runtime).
 *
 * RNG is drawn in a fixed order per created request (origin, dest, item count, then
 * per item: shape + value-per-cell, then lifetime, then the gap to the next spawn),
 * which keeps schedules reproducible.
 */
export function generateRequests(level: LevelConfig, cities: readonly City[]): DeliveryRequest[] {
  if (cities.length < 2) throw new Error('generateRequests needs at least 2 cities');
  const { spawn } = level;
  const rng = makeRng(level.seed);
  const shapes = getShapesForTiers(spawn.shapeTiers);
  const out: DeliveryRequest[] = [];
  const openWindows: number[] = []; // expiresAtMs of already-scheduled requests
  let t = spawn.firstAtMs;
  let n = 0;
  const GUARD = 4000; // runaway backstop

  while (t < level.durationMs && n < GUARD) {
    // Free windows that have closed by time t.
    for (let i = openWindows.length - 1; i >= 0; i--) {
      if ((openWindows[i] as number) <= t) openWindows.splice(i, 1);
    }
    if (openWindows.length >= spawn.maxConcurrent) {
      // Board would be full — jump to the soonest opening (no RNG consumed → deterministic).
      t = Math.max(t + 1, Math.min(...openWindows));
      continue;
    }

    const originIdx = randInt(rng, 0, cities.length - 1);
    let destIdx = randInt(rng, 0, cities.length - 2);
    if (destIdx >= originIdx) destIdx++; // uniform over cities ≠ origin
    const origin = cities[originIdx] as City;
    const dest = cities[destIdx] as City;

    const itemCount = randInt(rng, spawn.itemsPerRequest[0], spawn.itemsPerRequest[1]);
    const items: PolyominoItem[] = [];
    for (let j = 0; j < itemCount; j++) {
      const shape = pick(rng, shapes);
      const vpc = randRange(rng, spawn.valuePerCell[0], spawn.valuePerCell[1]);
      items.push({
        id: `r${n}_i${j}`,
        cells: shape.cells.map((c) => ({ x: c.x, y: c.y })),
        value: Math.round(shape.cells.length * vpc),
        label: shape.label,
      });
    }
    const baseReward = items.reduce((sum, it) => sum + it.value, 0);
    const life = randInt(rng, spawn.expiryMs[0], spawn.expiryMs[1]);
    const expiresAtMs = t + life;

    out.push({
      id: `r${n}`,
      originId: origin.id,
      destId: dest.id,
      items,
      spawnAtMs: t,
      expiresAtMs,
      status: 'scheduled',
      baseReward,
    });
    openWindows.push(expiresAtMs);
    n++;

    t += randInt(rng, spawn.intervalMs[0], spawn.intervalMs[1]);
  }
  return out;
}
