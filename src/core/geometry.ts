import type { Vec2 } from './types';

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Travel time for a straight hop. `speed` is map units per second. */
export function travelTimeMs(dist: number, speed: number): number {
  if (speed <= 0) return Infinity;
  return (dist / speed) * 1000;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPoint(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Fraction [0,1] of the way from departure to arrival at time `nowMs`. */
export function routeProgress(departedAtMs: number, arriveAtMs: number, nowMs: number): number {
  if (arriveAtMs <= departedAtMs) return 1;
  return clamp01((nowMs - departedAtMs) / (arriveAtMs - departedAtMs));
}

/** Total length of a (possibly two-segment) path from→via→to. */
export function pathLength(from: Vec2, via: Vec2 | undefined, to: Vec2): number {
  return via ? distance(from, via) + distance(via, to) : distance(from, to);
}

/** Position along a from→via→to path at fraction t (interpolated by arc length). */
export function pathPosition(from: Vec2, via: Vec2 | undefined, to: Vec2, t: number): Vec2 {
  if (!via) return lerpPoint(from, to, t);
  const d1 = distance(from, via);
  const d2 = distance(via, to);
  const total = d1 + d2;
  if (total === 0) return { x: to.x, y: to.y };
  const travelled = clamp01(t) * total;
  if (travelled <= d1) return lerpPoint(from, via, d1 === 0 ? 1 : travelled / d1);
  return lerpPoint(via, to, d2 === 0 ? 1 : (travelled - d1) / d2);
}
