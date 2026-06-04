import { describe, it, expect } from 'vitest';
import {
  canPlace,
  buildOccupancy,
  fillRatio,
  filledCells,
  placementCells,
  pieceAt,
  idx,
} from '../src/core/packing';
import type { PolyominoItem, Placement } from '../src/core/types';

const I4: PolyominoItem = {
  id: 'i',
  value: 100,
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ],
};
const O4: PolyominoItem = {
  id: 'o',
  value: 80,
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
};
const items = new Map<string, PolyominoItem>([
  [I4.id, I4],
  [O4.id, O4],
]);

function place(itemId: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0, flipped = false): Placement {
  return { itemId, rot, flipped, origin: { x, y } };
}

describe('packing', () => {
  it('accepts an in-bounds placement on an empty grid', () => {
    const empty = new Uint8Array(5 * 6);
    expect(canPlace(5, 6, empty, I4, place('i', 0, 0))).toBe(true);
  });

  it('rejects an out-of-bounds placement', () => {
    const empty = new Uint8Array(5 * 6);
    // I4 is 4 wide; origin x=2 → cells at x=2..5, but max valid x is 4.
    expect(canPlace(5, 6, empty, I4, place('i', 2, 0))).toBe(false);
  });

  it('rejects an overlapping placement', () => {
    const { occupied, ok } = buildOccupancy(5, 6, [place('o', 0, 0)], items);
    expect(ok).toBe(true);
    expect(canPlace(5, 6, occupied, O4, place('o', 0, 0))).toBe(false); // exact overlap
    expect(canPlace(5, 6, occupied, O4, place('o', 1, 0))).toBe(false); // partial overlap
    expect(canPlace(5, 6, occupied, O4, place('o', 2, 0))).toBe(true); // clear of it
  });

  it('placementCells reflects rotation', () => {
    // I4 rotated 90° at origin (0,0) becomes a vertical column x=0, y=0..3
    const cells = placementCells(I4, place('i', 0, 0, 1));
    const keys = cells.map((c) => `${c.x},${c.y}`).sort();
    expect(keys).toEqual(['0,0', '0,1', '0,2', '0,3']);
  });

  it('buildOccupancy counts filled cells and flags conflicts', () => {
    const good = buildOccupancy(5, 6, [place('i', 0, 0), place('o', 0, 1)], items);
    expect(good.ok).toBe(true);
    expect(filledCells(good.occupied)).toBe(8);
    // index of (0,1) on a width-5 grid is 5
    expect(good.occupied[idx(5, 0, 1)]).toBe(1);

    const bad = buildOccupancy(5, 6, [place('o', 0, 0), place('o', 0, 0)], items);
    expect(bad.ok).toBe(false);
  });

  it('fillRatio is filled / total', () => {
    const full = buildOccupancy(2, 2, [place('o', 0, 0)], items);
    expect(fillRatio(2, 2, full.occupied)).toBe(1);
    const half = buildOccupancy(4, 2, [place('o', 0, 0)], items);
    expect(fillRatio(4, 2, half.occupied)).toBe(0.5);
  });

  it('pieceAt finds the piece covering a cell, else null', () => {
    // I4 spans (0,0)..(3,0); O4 is the 2×2 block anchored at (0,1) → (0..1, 1..2).
    const placed = [place('i', 0, 0), place('o', 0, 1)];
    expect(pieceAt(placed, items, { x: 2, y: 0 })).toBe('i');
    expect(pieceAt(placed, items, { x: 1, y: 2 })).toBe('o');
    expect(pieceAt(placed, items, { x: 4, y: 4 })).toBeNull(); // empty cell
  });

  it('pieceAt respects orientation', () => {
    // I4 rotated 90° at (0,0) becomes a vertical column x=0, y=0..3.
    const placed = [place('i', 0, 0, 1)];
    expect(pieceAt(placed, items, { x: 0, y: 3 })).toBe('i'); // covered only once rotated
    expect(pieceAt(placed, items, { x: 1, y: 0 })).toBeNull(); // covered only in base orientation
  });

  it('pieceAt ignores placements whose item is unknown', () => {
    expect(pieceAt([place('ghost', 0, 0)], items, { x: 0, y: 0 })).toBeNull();
  });
});
