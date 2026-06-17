import { describe, it, expect } from 'vitest';
import { computeTransform, worldToScreen, screenToWorld, shipAnchor } from '../src/render/viewport';
import { config } from '../src/config';
import type { Airship, GameState, LevelConfig, Vec2 } from '../src/core/types';

const cfg: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'test',
  durationMs: 600_000,
  threshold: 1000,
  shipSpeed: 48,
  cityIds: [],
  ownedShips: [],
  npc: { enabled: false, spawnDistance: 0 },
  spawn: {
    firstAtMs: 0,
    intervalMs: [1, 1],
    maxConcurrent: 1,
    expiryMs: [1, 1],
    itemsPerRequest: [1, 1],
    shapeTiers: [1],
    valuePerCell: [1, 1],
  },
  seed: 1,
};

function ship(over: Partial<Airship> = {}): Airship {
  return {
    id: 's',
    shipClass: 'Scout',
    owned: true,
    charterCost: 0,
    holdW: 4,
    holdH: 4,
    status: 'idle',
    locationId: 'a',
    pos: { x: 7, y: 7 },
    ...over,
  };
}

function state(ships: Airship[], cities = [{ id: 'a', name: 'A', x: 100, y: 100 }]): GameState {
  return {
    levelIndex: 1,
    config: cfg,
    clockMs: 0,
    earnings: 0,
    cities,
    ships,
    requests: [],
    npcOffers: [],
    nextNpcRefreshMs: 999_999,
    outcome: 'playing',
    seed: 1,
    seq: 0,
    events: [],
  };
}

describe('computeTransform', () => {
  it('scales by the limiting axis and centers the map within the margin', () => {
    // A canvas matching the map aspect ratio (765×600) plus a 46px margin on every side.
    const t = computeTransform(765 + 92, 600 + 92, 46);
    expect(t.scale).toBeCloseTo(1); // both axes give exactly 1 → fits at native size
    // centered: equal letterbox on each side (here, just the margin)
    expect(t.ox).toBeCloseTo(46);
    expect(t.oy).toBeCloseTo(46);
  });

  it('letterboxes horizontally when the canvas is wider than the map aspect', () => {
    const t = computeTransform(4000, 600 + 92, 46); // very wide, height-limited
    expect(t.scale).toBeCloseTo((600 + 92 - 92) / config.MAP_H); // height is the binding constraint
    // map drawn narrower than the canvas → centered with a large horizontal offset
    expect(t.ox).toBeGreaterThan(t.oy);
    expect(t.ox).toBeCloseTo((4000 - config.MAP_W * t.scale) / 2);
  });

  it('letterboxes vertically when the canvas is taller than the map aspect', () => {
    const t = computeTransform(765 + 92, 4000, 46); // tall, width-limited
    expect(t.scale).toBeCloseTo((765 + 92 - 92) / config.MAP_W);
    expect(t.oy).toBeGreaterThan(t.ox);
  });

  it('stays finite and positive for a zero-size canvas (not yet laid out)', () => {
    const t = computeTransform(0, 0);
    expect(t.scale).toBeGreaterThan(0);
    expect(Number.isFinite(t.scale)).toBe(true);
    expect(Number.isFinite(t.ox)).toBe(true);
    expect(Number.isFinite(t.oy)).toBe(true);
  });
});

describe('worldToScreen / screenToWorld', () => {
  it('places the world origin and far corner at the transform edges', () => {
    const t = computeTransform(1200, 800);
    expect(worldToScreen({ x: 0, y: 0 }, t)).toEqual({ x: t.ox, y: t.oy });
    expect(worldToScreen({ x: config.MAP_W, y: config.MAP_H }, t)).toEqual({
      x: t.ox + config.MAP_W * t.scale,
      y: t.oy + config.MAP_H * t.scale,
    });
  });

  it('round-trips: screenToWorld inverts worldToScreen (the click→world contract)', () => {
    const transforms = [computeTransform(1200, 800), computeTransform(4000, 500), computeTransform(640, 1400)];
    const pts: Vec2[] = [
      { x: 0, y: 0 },
      { x: 370, y: 455 }, // a real dock coordinate
      { x: config.MAP_W, y: config.MAP_H },
      { x: -50, y: 999 }, // off-map clicks must still invert cleanly
    ];
    for (const t of transforms) {
      for (const p of pts) {
        const back = screenToWorld(worldToScreen(p, t), t);
        expect(back.x).toBeCloseTo(p.x);
        expect(back.y).toBeCloseTo(p.y);
      }
    }
  });
});

describe('shipAnchor', () => {
  it('uses the live position for flying and repositioning ships', () => {
    const s = state([ship({ status: 'flying', locationId: null, pos: { x: 222, y: 333 } })]);
    expect(shipAnchor(s, s.ships[0]!)).toEqual({ x: 222, y: 333 });

    const r = state([ship({ status: 'repositioning', locationId: null, pos: { x: 5, y: 6 } })]);
    expect(shipAnchor(r, r.ships[0]!)).toEqual({ x: 5, y: 6 });
  });

  it('hovers a lone docked ship centered just above its dock', () => {
    const s = state([ship({ status: 'idle', locationId: 'a' })]);
    expect(shipAnchor(s, s.ships[0]!)).toEqual({ x: 100, y: 100 - 34 });
  });

  it('fans several docked ships symmetrically around the dock (the contract hit-testing relies on)', () => {
    const a = ship({ id: 's1' });
    const b = ship({ id: 's2' });
    const s = state([a, b]);
    // n=2, spread 30 → ±15 about the dock x; both 34px above it
    expect(shipAnchor(s, a)).toEqual({ x: 100 - 15, y: 66 });
    expect(shipAnchor(s, b)).toEqual({ x: 100 + 15, y: 66 });

    const c = ship({ id: 's3' });
    const s3 = state([a, b, c]);
    expect(shipAnchor(s3, a).x).toBe(100 - 30);
    expect(shipAnchor(s3, b).x).toBe(100);
    expect(shipAnchor(s3, c).x).toBe(100 + 30);
  });

  it('counts a loading ship as a fan-out sibling', () => {
    const idle = ship({ id: 's1', status: 'idle' });
    const loading = ship({ id: 's2', status: 'loading' });
    const s = state([idle, loading]);
    expect(shipAnchor(s, idle)).toEqual({ x: 85, y: 66 });
    expect(shipAnchor(s, loading)).toEqual({ x: 115, y: 66 });
  });

  it('falls back to the raw position when the docked ship has no known city', () => {
    const s = state([ship({ status: 'idle', locationId: 'ghost', pos: { x: 11, y: 12 } })]);
    expect(shipAnchor(s, s.ships[0]!)).toEqual({ x: 11, y: 12 });
  });
});
