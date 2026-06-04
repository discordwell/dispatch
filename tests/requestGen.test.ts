import { describe, it, expect } from 'vitest';
import { generateRequests } from '../src/core/requestGen';
import { getLevel } from '../src/data/levels';
import { getCity } from '../src/data/cities';
import type { City } from '../src/core/types';

const level1 = getLevel(1);
const cities1: City[] = level1.cityIds.map(getCity);

describe('requestGen', () => {
  it('is fully deterministic for a seed', () => {
    const a = generateRequests(level1, cities1);
    const b = generateRequests(level1, cities1);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(a.map((r) => r.spawnAtMs)).toEqual(b.map((r) => r.spawnAtMs));
    expect(a.map((r) => r.expiresAtMs)).toEqual(b.map((r) => r.expiresAtMs));
    expect(a.map((r) => r.baseReward)).toEqual(b.map((r) => r.baseReward));
  });

  it('produces a non-trivial schedule within the shift', () => {
    const reqs = generateRequests(level1, cities1);
    expect(reqs.length).toBeGreaterThan(5); // ~8 over the 2-min ace-1 shift; just guards against a degenerate schedule
    for (const r of reqs) {
      expect(r.spawnAtMs).toBeGreaterThanOrEqual(level1.spawn.firstAtMs);
      expect(r.spawnAtMs).toBeLessThan(level1.durationMs);
      expect(r.originId).not.toBe(r.destId);
      expect(r.items.length).toBeGreaterThanOrEqual(level1.spawn.itemsPerRequest[0]);
      expect(r.items.length).toBeLessThanOrEqual(level1.spawn.itemsPerRequest[1]);
      expect(r.baseReward).toBeGreaterThan(0);
    }
  });

  it('never exceeds maxConcurrent overlapping windows', () => {
    const reqs = generateRequests(level1, cities1);
    for (let t = 0; t < level1.durationMs; t += 500) {
      const overlapping = reqs.filter((r) => r.spawnAtMs <= t && t < r.expiresAtMs).length;
      expect(overlapping).toBeLessThanOrEqual(level1.spawn.maxConcurrent);
    }
  });

  it('respects shape tiers (tiers 1–2 → pieces of 2..4 cells)', () => {
    const reqs = generateRequests(level1, cities1);
    for (const r of reqs) {
      for (const it of r.items) {
        expect(it.cells.length).toBeGreaterThanOrEqual(2);
        expect(it.cells.length).toBeLessThanOrEqual(4);
      }
    }
  });
});
