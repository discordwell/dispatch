import type { Placement, PolyominoItem, Rotation } from './types';
import { canPlace, placementCells, idx } from './packing';

/**
 * Greedy first-fit packer. NOT a player feature (the game is hand-packed) — this is
 * a utility for tests, the M4 scaffold, and headless playthroughs. It packs the
 * largest items first and takes the first valid orientation/position for each.
 */
export function autoPack(w: number, h: number, items: readonly PolyominoItem[]): Placement[] {
  const occupied = new Uint8Array(w * h);
  const placements: Placement[] = [];
  // Largest pieces first — they're the hardest to place once the hold fills up.
  const order = [...items].sort((a, b) => b.cells.length - a.cells.length);

  for (const item of order) {
    const p = firstFit(w, h, occupied, item);
    if (!p) continue;
    for (const c of placementCells(item, p)) occupied[idx(w, c.x, c.y)] = 1;
    placements.push(p);
  }
  return placements;
}

function firstFit(w: number, h: number, occupied: Uint8Array, item: PolyominoItem): Placement | null {
  for (let rot = 0 as Rotation; rot < 4; rot = (rot + 1) as Rotation) {
    for (const flipped of [false, true]) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p: Placement = { itemId: item.id, rot, flipped, origin: { x, y } };
          if (canPlace(w, h, occupied, item, p)) return p;
        }
      }
    }
  }
  return null;
}
