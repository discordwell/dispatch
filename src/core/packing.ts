import type { Cell, Placement, PolyominoItem } from './types';
import { orientedCells } from './polyomino';

export function idx(w: number, x: number, y: number): number {
  return y * w + x;
}

export function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

/** Absolute hold cells occupied by a placement of `item`. */
export function placementCells(item: PolyominoItem, p: Placement): Cell[] {
  return orientedCells(item.cells, p.rot, p.flipped).map((c) => ({
    x: c.x + p.origin.x,
    y: c.y + p.origin.y,
  }));
}

/** Can an already-oriented, already-translated set of cells sit on the grid? */
export function canPlaceCells(
  w: number,
  h: number,
  occupied: Uint8Array,
  cells: readonly Cell[],
): boolean {
  for (const c of cells) {
    if (!inBounds(w, h, c.x, c.y)) return false;
    if (occupied[idx(w, c.x, c.y)] === 1) return false;
  }
  return true;
}

export function canPlace(
  w: number,
  h: number,
  occupied: Uint8Array,
  item: PolyominoItem,
  p: Placement,
): boolean {
  return canPlaceCells(w, h, occupied, placementCells(item, p));
}

/**
 * Derive the occupancy grid from a list of placements. `ok` is false if any
 * placement is out of bounds or overlaps another — the source of truth is always
 * `placements`, never a stored grid, so this can't go stale.
 */
export function buildOccupancy(
  w: number,
  h: number,
  placements: readonly Placement[],
  items: ReadonlyMap<string, PolyominoItem>,
): { occupied: Uint8Array; ok: boolean } {
  const occupied = new Uint8Array(w * h);
  let ok = true;
  for (const p of placements) {
    const item = items.get(p.itemId);
    if (!item) {
      ok = false;
      continue;
    }
    for (const c of placementCells(item, p)) {
      if (!inBounds(w, h, c.x, c.y) || occupied[idx(w, c.x, c.y)] === 1) {
        ok = false;
        continue;
      }
      occupied[idx(w, c.x, c.y)] = 1;
    }
  }
  return { occupied, ok };
}

export function filledCells(occupied: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < occupied.length; i++) if (occupied[i] === 1) n++;
  return n;
}

export function fillRatio(w: number, h: number, occupied: Uint8Array): number {
  const total = w * h;
  return total === 0 ? 0 : filledCells(occupied) / total;
}
