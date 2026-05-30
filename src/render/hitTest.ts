import type { GameState, Vec2 } from '../core/types';
import { shipAnchor } from './viewport';

export interface Pick {
  type: 'city' | 'ship';
  id: string;
}

/** Pick the topmost ship or nearest city under a world-space point (ships are drawn above). */
export function pickAt(s: GameState, world: Vec2, shipR = 16, cityR = 26): Pick | null {
  for (const ship of s.ships) {
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
