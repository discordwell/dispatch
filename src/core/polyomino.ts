import type { Cell, Rotation } from './types';

/** Translate cells so min(x)=min(y)=0 and sort into a canonical order. */
export function normalize(cells: readonly Cell[]): Cell[] {
  if (cells.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  const shifted = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  shifted.sort((p, q) => p.y - q.y || p.x - q.x);
  return shifted;
}

/** Rotate 90° clockwise: (x,y) → (y, −x), then re-normalize. */
export function rotate90(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map((c) => ({ x: c.y, y: -c.x })));
}

export function rotateN(cells: readonly Cell[], n: Rotation): Cell[] {
  let out = normalize(cells);
  const times = ((n % 4) + 4) % 4;
  for (let i = 0; i < times; i++) out = rotate90(out);
  return out;
}

/** Horizontal mirror: (x,y) → (−x, y), then re-normalize. */
export function flip(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map((c) => ({ x: -c.x, y: c.y })));
}

/** Canonical cell set for a piece placed at a given orientation (flip applied before rotation). */
export function orientedCells(cells: readonly Cell[], rot: Rotation, flipped: boolean): Cell[] {
  const base = flipped ? flip(cells) : normalize(cells);
  return rotateN(base, rot);
}

export interface BBox {
  w: number;
  h: number;
}

export function boundingBox(cells: readonly Cell[]): BBox {
  const n = normalize(cells);
  if (n.length === 0) return { w: 0, h: 0 };
  let maxX = 0;
  let maxY = 0;
  for (const c of n) {
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { w: maxX + 1, h: maxY + 1 };
}

/** Stable string key for equality / dedup of an orientation. */
export function cellsKey(cells: readonly Cell[]): string {
  return normalize(cells)
    .map((c) => `${c.x},${c.y}`)
    .join(';');
}
