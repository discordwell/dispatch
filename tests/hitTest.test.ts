import { describe, it, expect } from 'vitest';
import { pickAt } from '../src/render/hitTest';
import type { Airship, GameState, LevelConfig } from '../src/core/types';

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

function flying(id: string, x: number, y: number): Airship {
  return {
    id,
    shipClass: 'Scout',
    owned: true,
    charterCost: 0,
    holdW: 4,
    holdH: 4,
    status: 'flying',
    locationId: null,
    pos: { x, y },
  };
}

function idleAt(id: string, locationId: string, x: number, y: number): Airship {
  return { ...flying(id, x, y), status: 'idle', locationId };
}

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    levelIndex: 1,
    config: cfg,
    clockMs: 0,
    earnings: 0,
    cities: [
      { id: 'a', name: 'A', x: 100, y: 100 },
      { id: 'b', name: 'B', x: 160, y: 100 },
    ],
    ships: [],
    requests: [],
    npcOffers: [],
    nextNpcRefreshMs: 999_999,
    outcome: 'playing',
    seed: 1,
    seq: 0,
    events: [],
    ...over,
  };
}

describe('pickAt', () => {
  it('returns null when nothing is in range', () => {
    const s = baseState({ ships: [flying('s1', 400, 400)] });
    expect(pickAt(s, { x: 300, y: 300 })).toBeNull();
  });

  it('picks the topmost of overlapping ships (last drawn wins, matching render order)', () => {
    // MapRenderer paints ships in array order, so s2 is drawn over s1 here.
    const s = baseState({ ships: [flying('s1', 300, 300), flying('s2', 305, 300)] });
    expect(pickAt(s, { x: 302, y: 300 })).toEqual({ type: 'ship', id: 's2' });
  });

  it('picks the visible (topmost) ship among several fanned out at one dock', () => {
    // Two idle ships at city 'a' fan to x = 100 ± 15, y = 66; the midpoint is inside
    // both pick radii and s2 is the one drawn on top.
    const s = baseState({ ships: [idleAt('s1', 'a', 100, 100), idleAt('s2', 'a', 100, 100)] });
    expect(pickAt(s, { x: 100, y: 66 })).toEqual({ type: 'ship', id: 's2' });
    // Off to the left fan position only s1 remains in range.
    expect(pickAt(s, { x: 85 - 10, y: 66 })).toEqual({ type: 'ship', id: 's1' });
  });

  it('prefers a ship over the city underneath it', () => {
    const s = baseState({ ships: [flying('s1', 100, 100)] });
    expect(pickAt(s, { x: 100, y: 100 })).toEqual({ type: 'ship', id: 's1' });
  });

  it('picks the nearest city when several are in range', () => {
    const s = baseState();
    expect(pickAt(s, { x: 126, y: 100 })).toEqual({ type: 'city', id: 'a' }); // 26 vs 34
    expect(pickAt(s, { x: 134, y: 100 })).toEqual({ type: 'city', id: 'b' }); // 34 vs 26
  });
});
