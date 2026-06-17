import { describe, it, expect } from 'vitest';
import {
  distance,
  travelTimeMs,
  lerp,
  lerpPoint,
  clamp01,
  routeProgress,
  cumulativeLengths,
  polylinePosition,
  routePolyline,
  nearestNeighbourOrder,
} from '../src/core/geometry';

describe('geometry', () => {
  it('distance is symmetric, zero to self, and Pythagorean', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(distance(a, b)).toBe(5);
    expect(distance(b, a)).toBe(5);
    expect(distance(a, a)).toBe(0);
  });

  it('travelTimeMs is proportional to distance and guards zero speed', () => {
    expect(travelTimeMs(100, 100)).toBe(1000);
    expect(travelTimeMs(200, 100)).toBe(2000);
    expect(travelTimeMs(50, 100)).toBe(500);
    expect(travelTimeMs(100, 0)).toBe(Infinity);
  });

  it('lerp / lerpPoint interpolate', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
  });

  it('clamp01 clamps', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });

  it('routeProgress clamps to [0,1] and handles degenerate routes', () => {
    expect(routeProgress(0, 1000, 0)).toBe(0);
    expect(routeProgress(0, 1000, 500)).toBe(0.5);
    expect(routeProgress(0, 1000, 1000)).toBe(1);
    expect(routeProgress(0, 1000, -50)).toBe(0);
    expect(routeProgress(0, 1000, 99999)).toBe(1);
    expect(routeProgress(500, 500, 500)).toBe(1); // zero-length route
  });
});

describe('multi-stop geometry', () => {
  const L = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]; // arc lengths 0,3,7

  it('cumulativeLengths accumulates per-segment distance', () => {
    expect(cumulativeLengths(L)).toEqual([0, 3, 7]);
    expect(cumulativeLengths([{ x: 5, y: 5 }])).toEqual([0]);
  });

  it('polylinePosition walks the polyline by arc length', () => {
    expect(polylinePosition(L, 0)).toEqual({ x: 0, y: 0 });
    expect(polylinePosition(L, 1)).toEqual({ x: 3, y: 4 });
    expect(polylinePosition(L, 3 / 7)).toEqual({ x: 3, y: 0 }); // exactly the corner
    expect(polylinePosition(L, 0.5)).toEqual({ x: 3, y: 0.5 }); // half of total length (3.5)
  });

  it('polylinePosition clamps t and handles degenerate inputs', () => {
    expect(polylinePosition(L, -1)).toEqual({ x: 0, y: 0 });
    expect(polylinePosition(L, 2)).toEqual({ x: 3, y: 4 });
    expect(polylinePosition([{ x: 5, y: 5 }], 0.7)).toEqual({ x: 5, y: 5 }); // single point
    expect(polylinePosition([{ x: 2, y: 2 }, { x: 2, y: 2 }], 0.5)).toEqual({ x: 2, y: 2 }); // zero length
  });

  it('routePolyline prepends the departure point to the stop positions', () => {
    const stops = [{ pos: { x: 1, y: 1 } }, { pos: { x: 2, y: 2 } }];
    expect(routePolyline({ x: 0, y: 0 }, stops)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });
});

describe('nearestNeighbourOrder', () => {
  const id = (p: { id: string }) => p.id;

  it('hops to the closest remaining point at each step (not just sorted by start distance)', () => {
    // Start at the origin. Distance-from-start order would be A(30) C(40) B(60); but greedy
    // visits A, then B (A→B is 30 vs A→C 50), then C — a different order. This is the property
    // the milk-run router depends on, and the case the old 2-stop tests (which tied) never hit.
    const start = { x: 0, y: 0 };
    const A = { id: 'a', x: 30, y: 0 };
    const B = { id: 'b', x: 60, y: 0 };
    const C = { id: 'c', x: 0, y: 40 };
    expect(nearestNeighbourOrder(start, [A, B, C], id).map(id)).toEqual(['a', 'b', 'c']);
    // input order must not change the result
    expect(nearestNeighbourOrder(start, [C, B, A], id).map(id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks equal-distance ties by tieKey, deterministically regardless of input order', () => {
    const start = { x: 0, y: 0 };
    const east = { id: 'east', x: 5, y: 0 }; // both 5 from start
    const south = { id: 'aaa', x: 0, y: 5 };
    expect(nearestNeighbourOrder(start, [east, south], id).map(id)).toEqual(['aaa', 'east']);
    expect(nearestNeighbourOrder(start, [south, east], id).map(id)).toEqual(['aaa', 'east']);
  });

  it('with no tieKey, preserves input order among equidistant points', () => {
    const start = { x: 0, y: 0 };
    const east = { id: 'east', x: 5, y: 0 };
    const south = { id: 'south', x: 0, y: 5 };
    expect(nearestNeighbourOrder(start, [east, south]).map(id)).toEqual(['east', 'south']);
    expect(nearestNeighbourOrder(start, [south, east]).map(id)).toEqual(['south', 'east']);
  });

  it('returns empty/single inputs unchanged and never mutates the input array', () => {
    expect(nearestNeighbourOrder({ x: 0, y: 0 }, [])).toEqual([]);
    const one = [{ id: 'only', x: 9, y: 9 }];
    expect(nearestNeighbourOrder({ x: 0, y: 0 }, one, id).map(id)).toEqual(['only']);
    const input = [
      { id: 'a', x: 30, y: 0 },
      { id: 'b', x: 60, y: 0 },
      { id: 'c', x: 0, y: 40 },
    ];
    const before = input.map(id);
    nearestNeighbourOrder({ x: 0, y: 0 }, input, id);
    expect(input.map(id)).toEqual(before); // input untouched
  });
});
