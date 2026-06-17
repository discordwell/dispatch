import { describe, it, expect } from 'vitest';
import { autoPack } from '../src/core/autopack';
import { buildOccupancy, filledCells } from '../src/core/packing';
import { orientedCells } from '../src/core/polyomino';
import type { Cell, Placement, PolyominoItem } from '../src/core/types';

/**
 * `autoPack` is the greedy first-fit packer behind every headless playthrough — `autoAssign`,
 * `tests/levels.test` (the winnability proof), and `measure-balance.ts`. None of those would be
 * meaningful if autoPack produced an INVALID pack: an out-of-bounds or overlapping placement
 * makes `commitLoad`'s own `buildOccupancy(...).ok` check reject the load, quietly craters the
 * dispatcher's earnings, and turns the balance numbers into noise. So this file pins the contract
 * autoPack must keep — validity above all — plus the heuristic (largest-first, uses orientation)
 * that the balance tuning assumes. Pure, deterministic, no DOM.
 */

const C = (x: number, y: number): Cell => ({ x, y });
const item = (id: string, cells: Cell[], value = 10 * cells.length): PolyominoItem => ({ id, cells, value });
const itemMap = (items: readonly PolyominoItem[]): Map<string, PolyominoItem> =>
  new Map(items.map((i) => [i.id, i]));

/** Every placement autoPack returns must be in-bounds, non-overlapping, and a distinct input item. */
function assertValidPack(
  w: number,
  h: number,
  placements: Placement[],
  items: readonly PolyominoItem[],
): { filled: number } {
  const m = itemMap(items);
  const { occupied, ok } = buildOccupancy(w, h, placements, m);
  // ok === false means an overlap or an out-of-bounds cell — the failure that silently breaks balance.
  expect(ok, 'pack must be in-bounds and non-overlapping').toBe(true);

  const ids = placements.map((p) => p.itemId);
  expect(new Set(ids).size, 'no item placed twice').toBe(ids.length);
  for (const id of ids) expect(m.has(id), `placed item ${id} is one of the inputs`).toBe(true);

  // No cell double-counted: filled cells must equal the summed cell-count of placed pieces.
  const cellSum = ids.reduce((n, id) => n + m.get(id)!.cells.length, 0);
  expect(filledCells(occupied), 'filled cells == summed piece sizes (i.e. truly disjoint)').toBe(cellSum);
  return { filled: cellSum };
}

const sizeOf = (m: Map<string, PolyominoItem>, p: Placement): number => m.get(p.itemId)!.cells.length;

describe('autoPack — validity invariant (the contract balance rests on)', () => {
  it('never returns an out-of-bounds or overlapping placement, across hold sizes', () => {
    const items = [
      item('a', [C(0, 0), C(1, 0), C(2, 0)]), // I-tromino
      item('b', [C(0, 0), C(1, 0), C(0, 1), C(1, 1)]), // square
      item('c', [C(0, 0), C(0, 1), C(0, 2), C(1, 2)]), // L
      item('d', [C(0, 0), C(1, 0)]), // domino
      item('e', [C(1, 0), C(0, 1), C(1, 1), C(2, 1), C(1, 2)]), // plus
    ];
    for (const [w, h] of [[4, 4], [5, 6], [6, 8], [3, 3], [1, 5]] as const) {
      const placements = autoPack(w, h, items);
      assertValidPack(w, h, placements, items);
    }
  });

  it('placed cells exactly match the union of each placement’s oriented cells', () => {
    const items = [
      item('sq', [C(0, 0), C(1, 0), C(0, 1), C(1, 1)]),
      item('ell', [C(0, 0), C(0, 1), C(0, 2), C(1, 2)]),
    ];
    const w = 4;
    const h = 4;
    const placements = autoPack(w, h, items);
    const m = itemMap(items);
    // Recompute the occupied set by hand from the returned placements and compare to buildOccupancy.
    const byHand = new Set<string>();
    for (const p of placements) {
      for (const c of orientedCells(m.get(p.itemId)!.cells, p.rot, p.flipped)) {
        const x = c.x + p.origin.x;
        const y = c.y + p.origin.y;
        expect(x >= 0 && y >= 0 && x < w && y < h, 'oriented cell in bounds').toBe(true);
        const key = `${x},${y}`;
        expect(byHand.has(key), 'no two pieces claim the same cell').toBe(false);
        byHand.add(key);
      }
    }
    const { occupied } = buildOccupancy(w, h, placements, m);
    expect(filledCells(occupied)).toBe(byHand.size);
  });
});

describe('autoPack — coverage', () => {
  it('packs every item when the hold has room', () => {
    const items = [
      item('a', [C(0, 0), C(1, 0)]),
      item('b', [C(0, 0), C(1, 0), C(2, 0)]),
      item('c', [C(0, 0), C(1, 0), C(0, 1), C(1, 1)]),
    ]; // 2 + 3 + 4 = 9 cells into a 6×6 (36) — trivially fits
    const placements = autoPack(6, 6, items);
    expect(placements).toHaveLength(3);
    assertValidPack(6, 6, placements, items);
  });

  it('returns an empty pack for no items', () => {
    expect(autoPack(4, 4, [])).toEqual([]);
  });

  it('skips a piece that cannot fit the hold in any orientation', () => {
    const big = item('pento', [C(0, 0), C(1, 0), C(2, 0), C(3, 0), C(4, 0)]); // length-5 bar
    expect(autoPack(2, 2, [big])).toEqual([]); // 5 cells / 5-long can't fit a 2×2 at any rotation
  });

  it('does a partial pack when items exceed capacity, keeping the result valid', () => {
    // Five 2×2 squares (20 cells) into a 4×4 (16 cells) — at most four can fit.
    const square = (id: string): PolyominoItem => item(id, [C(0, 0), C(1, 0), C(0, 1), C(1, 1)]);
    const items = [square('s1'), square('s2'), square('s3'), square('s4'), square('s5')];
    const placements = autoPack(4, 4, items);
    expect(placements.length).toBeLessThan(items.length); // couldn't take them all
    const { filled } = assertValidPack(4, 4, placements, items);
    expect(filled).toBeLessThanOrEqual(16);
  });
});

describe('autoPack — heuristic the balance harness assumes', () => {
  it('orders placements largest-first regardless of input order', () => {
    // Three differently-sized bars that all fit a 6×2; fed in scrambled, packed big→small.
    const dom = item('dom', [C(0, 0), C(1, 0)]); // 2
    const tet = item('tet', [C(0, 0), C(1, 0), C(2, 0), C(3, 0)]); // 4
    const tri = item('tri', [C(0, 0), C(1, 0), C(2, 0)]); // 3
    const m = itemMap([dom, tet, tri]);
    const placements = autoPack(6, 2, [dom, tet, tri]); // scrambled input
    expect(placements).toHaveLength(3);
    expect(placements.map((p) => sizeOf(m, p))).toEqual([4, 3, 2]); // strictly largest-first
    assertValidPack(6, 2, placements, [dom, tet, tri]);
  });

  it('largest-first changes the OUTCOME: it fits the big piece a small-first pass would block', () => {
    // 2×3 hold. The P-pentomino fills 5 of 6 cells; a domino fills 2. They cannot coexist.
    // Largest-first places the pentomino (fill 5/6). A naive small-first pass would seat the
    // domino and then fail to fit the pentomino (fill 2/6) — so this discriminates the sort.
    const p5 = item('p5', [C(0, 0), C(1, 0), C(0, 1), C(1, 1), C(0, 2)], 50); // P-pentomino, bbox 2×3
    const dom = item('dom', [C(0, 0), C(1, 0)], 20);
    const placements = autoPack(2, 3, [dom, p5]); // domino listed first to prove the re-sort
    expect(placements.map((p) => p.itemId)).toEqual(['p5']); // the big piece, not the domino
    const { filled } = assertValidPack(2, 3, placements, [dom, p5]);
    expect(filled).toBe(5); // 5/6, not the 2/6 a small-first pack would yield
  });

  it('rotates a piece that only fits the hold in a non-base orientation', () => {
    // A horizontal 1×3 bar can't sit in a 1-wide hold as-is; autoPack must rotate it upright.
    const bar = item('bar', [C(0, 0), C(1, 0), C(2, 0)]);
    const placements = autoPack(1, 3, [bar]);
    expect(placements).toHaveLength(1);
    expect(placements[0]!.rot % 2).toBe(1); // 90° or 270° — turned to vertical
    const { filled } = assertValidPack(1, 3, placements, [bar]);
    expect(filled).toBe(3); // fills the whole strip
  });

  it('achieves a perfect tiling when one exists (four 2×2 squares fill a 4×4)', () => {
    const square = (id: string): PolyominoItem => item(id, [C(0, 0), C(1, 0), C(0, 1), C(1, 1)]);
    const items = [square('s1'), square('s2'), square('s3'), square('s4')];
    const placements = autoPack(4, 4, items);
    expect(placements).toHaveLength(4);
    const { occupied } = buildOccupancy(4, 4, placements, itemMap(items));
    expect(filledCells(occupied)).toBe(16); // 100% fill — the efficiency-bonus ceiling
  });
});

describe('autoPack — determinism', () => {
  it('is a pure function: identical inputs yield an identical pack', () => {
    const items = [
      item('a', [C(0, 0), C(1, 0), C(2, 0)]),
      item('b', [C(0, 0), C(1, 0), C(0, 1), C(1, 1)]),
      item('c', [C(1, 0), C(0, 1), C(1, 1), C(2, 1), C(1, 2)]),
      item('d', [C(0, 0), C(1, 0)]),
    ];
    const first = autoPack(5, 6, items);
    const second = autoPack(5, 6, items);
    expect(second).toEqual(first);
  });

  it('breaks size ties by input order (stable sort), so equal-size pieces are placed in order', () => {
    // Three same-size dominoes, distinct ids: the stable sort must keep a, b, c in that order.
    const a = item('a', [C(0, 0), C(1, 0)]);
    const b = item('b', [C(0, 0), C(1, 0)]);
    const c = item('c', [C(0, 0), C(1, 0)]);
    const placements = autoPack(2, 3, [a, b, c]); // 3 dominoes stack cleanly in a 2×3
    expect(placements.map((p) => p.itemId)).toEqual(['a', 'b', 'c']);
    assertValidPack(2, 3, placements, [a, b, c]);
  });
});
