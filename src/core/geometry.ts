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

/** Cumulative arc length at each vertex of a polyline. out[0] === 0; out.length === pts.length. */
export function cumulativeLengths(pts: readonly Vec2[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1]! + distance(pts[i - 1]!, pts[i]!));
  return out;
}

/** Position along a multi-vertex polyline at fraction t∈[0,1] of its total arc length. */
export function polylinePosition(pts: readonly Vec2[], t: number): Vec2 {
  if (pts.length === 0) return { x: 0, y: 0 };
  const last = pts[pts.length - 1]!;
  if (pts.length === 1) return { x: pts[0]!.x, y: pts[0]!.y };
  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1]!;
  if (total === 0) return { x: last.x, y: last.y };
  const d = clamp01(t) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i]! < d) i++;
  const segLen = cum[i]! - cum[i - 1]!;
  const localT = segLen === 0 ? 1 : (d - cum[i - 1]!) / segLen;
  return lerpPoint(pts[i - 1]!, pts[i]!, localT);
}

/** The polyline a route traces: its departure point followed by each stop position. */
export function routePolyline(from: Vec2, stops: readonly { pos: Vec2 }[]): Vec2[] {
  return [from, ...stops.map((s) => s.pos)];
}
