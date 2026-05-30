import { config } from '../config';
import type { Airship, GameState, Vec2 } from '../core/types';

export interface Transform {
  scale: number;
  ox: number;
  oy: number;
}

/** Fit the MAP_W×MAP_H world into the canvas (letterboxed, centered) with a margin. */
export function computeTransform(cssW: number, cssH: number, margin = 46): Transform {
  const availW = Math.max(1, cssW - margin * 2);
  const availH = Math.max(1, cssH - margin * 2);
  const scale = Math.min(availW / config.MAP_W, availH / config.MAP_H);
  return {
    scale,
    ox: (cssW - config.MAP_W * scale) / 2,
    oy: (cssH - config.MAP_H * scale) / 2,
  };
}

export function worldToScreen(p: Vec2, t: Transform): Vec2 {
  return { x: p.x * t.scale + t.ox, y: p.y * t.scale + t.oy };
}

export function screenToWorld(p: Vec2, t: Transform): Vec2 {
  return { x: (p.x - t.ox) / t.scale, y: (p.y - t.oy) / t.scale };
}

/**
 * Where a ship is drawn (and hit-tested). Flying ships use their live position;
 * idle/loading ships hover just above their city, fanned out if several share it.
 */
export function shipAnchor(s: GameState, ship: Airship): Vec2 {
  if (ship.status === 'flying' || ship.status === 'repositioning') return ship.pos;
  const city = s.cities.find((c) => c.id === ship.locationId);
  if (!city) return ship.pos;
  const siblings = s.ships.filter(
    (o) =>
      (o.status === 'idle' || o.status === 'loading') && o.locationId === ship.locationId,
  );
  const i = Math.max(0, siblings.indexOf(ship));
  const n = siblings.length;
  const spread = 30;
  return { x: city.x + (i - (n - 1) / 2) * spread, y: city.y - 34 };
}
