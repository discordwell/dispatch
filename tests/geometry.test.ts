import { describe, it, expect } from 'vitest';
import {
  distance,
  travelTimeMs,
  lerp,
  lerpPoint,
  clamp01,
  routeProgress,
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
