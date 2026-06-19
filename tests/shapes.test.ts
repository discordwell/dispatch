import { describe, it, expect } from 'vitest';
import { SHAPES, getShapesForTiers, type ShapeDef } from '../src/data/shapes';
import { cellsKey, normalize, orientedCells } from '../src/core/polyomino';
import type { Cell, Rotation } from '../src/core/types';

/** Canonical key of a polyomino up to rotation + reflection (smallest over all 8 orientations). */
function canonical(cells: readonly Cell[]): string {
  let best: string | null = null;
  for (let r = 0 as Rotation; r < 4; r = (r + 1) as Rotation) {
    for (const flipped of [false, true]) {
      const k = cellsKey(orientedCells(cells, r, flipped));
      if (best === null || k < best) best = k;
    }
  }
  return best!;
}

/** Is the cell set a single 4-connected piece? (A polyomino must not be in disjoint blobs.) */
function isConnected(cells: readonly Cell[]): boolean {
  if (cells.length === 0) return false;
  const key = (c: Cell): string => `${c.x},${c.y}`;
  const all = new Set(cells.map(key));
  const seen = new Set<string>();
  const stack: Cell[] = [cells[0]!];
  seen.add(key(cells[0]!));
  while (stack.length) {
    const c = stack.pop()!;
    for (const n of [
      { x: c.x + 1, y: c.y },
      { x: c.x - 1, y: c.y },
      { x: c.x, y: c.y + 1 },
      { x: c.x, y: c.y - 1 },
    ]) {
      const k = key(n);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(n);
      }
    }
  }
  return seen.size === cells.length;
}

/** Expected cell count for a tier: tier 1 = dominoes/trominoes (2–3), 2 = tetrominoes, 3/4 = pentominoes. */
function cellCountOk(shape: ShapeDef): boolean {
  if (shape.tier === 1) return shape.cells.length === 2 || shape.cells.length === 3;
  if (shape.tier === 2) return shape.cells.length === 4;
  return shape.cells.length === 5; // tiers 3 & 4
}

describe('shape library', () => {
  it('every shape is a valid, connected polyomino with distinct cells', () => {
    for (const s of SHAPES) {
      expect(s.cells.length, `${s.id} non-empty`).toBeGreaterThan(0);
      // integer coordinates, no duplicate cells
      for (const c of s.cells) {
        expect(Number.isInteger(c.x) && Number.isInteger(c.y), `${s.id} integer cells`).toBe(true);
      }
      const distinct = new Set(s.cells.map((c) => `${c.x},${c.y}`));
      expect(distinct.size, `${s.id} has no duplicate cells`).toBe(s.cells.length);
      expect(isConnected(s.cells), `${s.id} is 4-connected`).toBe(true);
    }
  });

  it('every base orientation is normalized (min x = min y = 0)', () => {
    // The packer normalizes on use, but the source data should already be clean so the
    // board glyphs and tray render from a tight, origin-anchored box.
    for (const s of SHAPES) {
      const minX = Math.min(...s.cells.map((c) => c.x));
      const minY = Math.min(...s.cells.map((c) => c.y));
      expect(minX, `${s.id} min x`).toBe(0);
      expect(minY, `${s.id} min y`).toBe(0);
    }
  });

  it('tier matches piece size, and tiers are in range', () => {
    for (const s of SHAPES) {
      expect(s.tier, `${s.id} tier in [1,4]`).toBeGreaterThanOrEqual(1);
      expect(s.tier, `${s.id} tier in [1,4]`).toBeLessThanOrEqual(4);
      expect(cellCountOk(s), `${s.id} tier ${s.tier} size ${s.cells.length}`).toBe(true);
    }
  });

  it('ids, labels, and exact base orientations are all unique', () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
    expect(new Set(SHAPES.map((s) => s.label)).size).toBe(SHAPES.length);
    // No two shapes share the SAME base orientation (S vs Z etc. differ by base, so they survive —
    // this only catches an accidental copy-paste of an identical piece).
    const bases = SHAPES.map((s) => cellsKey(normalize(s.cells)));
    expect(new Set(bases).size).toBe(SHAPES.length);
  });

  it('the pentomino tiers cover all twelve free pentominoes, each exactly once', () => {
    // The twelve free pentominoes, by canonical (rotation+reflection) form. The library's
    // tier-3/4 shapes should be exactly this set — no gaps, no rotations of the same piece twice.
    const FREE_PENTOMINOES: Record<string, Cell[]> = {
      F: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
      I: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
      L: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }],
      N: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 3 }],
      P: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }],
      T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
      U: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      V: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
      W: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
      X: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
      Y: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
      Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
    };
    const expected = new Set(Object.values(FREE_PENTOMINOES).map(canonical));
    expect(expected.size, 'the twelve canonical pentominoes are distinct').toBe(12);

    const pentominoes = SHAPES.filter((s) => s.tier === 3 || s.tier === 4);
    const present = pentominoes.map((s) => canonical(s.cells));
    expect(present.length, 'twelve pentomino shapes in the library').toBe(12);
    expect(new Set(present).size, 'no two are the same pentomino').toBe(12);
    expect(new Set(present)).toEqual(expected);
  });

  it('the two new shapes are exactly the I- and V-pentominoes', () => {
    const I = canonical([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }]);
    const V = canonical([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }]);
    const driveShaft = SHAPES.find((s) => s.id === 'drive-shaft')!;
    const gantryArm = SHAPES.find((s) => s.id === 'gantry-arm')!;
    expect(canonical(driveShaft.cells)).toBe(I);
    expect(canonical(gantryArm.cells)).toBe(V);
    expect(driveShaft.tier).toBe(4);
    expect(gantryArm.tier).toBe(4);
  });
});

describe('getShapesForTiers', () => {
  it('returns only shapes in the requested tiers', () => {
    const t12 = getShapesForTiers([1, 2]);
    expect(t12.length).toBeGreaterThan(0);
    for (const s of t12) expect([1, 2]).toContain(s.tier);
    // L1 draws from tiers 1–2 only — it must never see a pentomino.
    expect(t12.every((s) => s.cells.length <= 4)).toBe(true);
  });

  it('preserves library order so existing level RNG schedules are stable', () => {
    const t4 = getShapesForTiers([4]);
    const expected = SHAPES.filter((s) => s.tier === 4).map((s) => s.id);
    expect(t4.map((s) => s.id)).toEqual(expected);
    // the two new pentominoes are appended last (so tiers 1–3 levels are byte-identical)
    expect(t4.slice(-2).map((s) => s.id)).toEqual(['drive-shaft', 'gantry-arm']);
  });

  it('throws when no shapes match the requested tiers', () => {
    expect(() => getShapesForTiers([9])).toThrow();
  });
});
