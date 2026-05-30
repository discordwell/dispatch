import { describe, it, expect } from 'vitest';
import { makeRng, randInt, randRange, pick } from '../src/core/rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('produces values in [0,1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt stays within inclusive bounds', () => {
    const r = makeRng(99);
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 2000; i++) {
      const v = randInt(r, 3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      if (v === 3) sawMin = true;
      if (v === 6) sawMax = true;
    }
    expect(sawMin && sawMax).toBe(true);
  });

  it('randRange stays within [min,max)', () => {
    const r = makeRng(123);
    for (let i = 0; i < 500; i++) {
      const v = randRange(r, 10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('pick is deterministic and rejects empty arrays', () => {
    const r1 = makeRng(5);
    const r2 = makeRng(5);
    const arr = ['a', 'b', 'c', 'd'];
    expect(pick(r1, arr)).toBe(pick(r2, arr));
    expect(() => pick(makeRng(1), [])).toThrow();
  });
});
