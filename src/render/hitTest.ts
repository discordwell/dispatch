import type { GameState, Vec2 } from '../core/types';
import { shipAnchor } from './viewport';

export interface Pick {
  type: 'city' | 'ship';
  id: string;
}

/** Pick the topmost ship or nearest city under a world-space point (ships are drawn above). */
export function pickAt(s: GameState, world: Vec2, shipR = 16, cityR = 26): Pick | null {
  // MapRenderer draws ships in array order, so the LAST overlapping ship is the visible one.
  for (let i = s.ships.length - 1; i >= 0; i--) {
    const ship = s.ships[i]!;
    const a = shipAnchor(s, ship);
    if (Math.hypot(a.x - world.x, a.y - world.y) <= shipR) return { type: 'ship', id: ship.id };
  }
  let best: Pick | null = null;
  let bestD = cityR;
  for (const c of s.cities) {
    const d = Math.hypot(c.x - world.x, c.y - world.y);
    if (d <= bestD) {
      bestD = d;
      best = { type: 'city', id: c.id };
    }
  }
  return best;
}
