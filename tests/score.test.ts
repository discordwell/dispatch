import { describe, it, expect } from 'vitest';
import { summarizeShift } from '../src/core/score';
import { step } from '../src/core/sim';
import { createGameState } from '../src/core/setup';
import type { DeliveryRequest, GameState, LevelConfig, Outcome, RequestStatus } from '../src/core/types';

const cfg: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'test',
  durationMs: 600_000,
  threshold: 1000,
  shipSpeed: 48,
  cityIds: ['a', 'b'],
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

let seq = 0;
function req(status: RequestStatus): DeliveryRequest {
  return {
    id: `r${seq++}`,
    originId: 'a',
    destId: 'b',
    items: [],
    spawnAtMs: 0,
    expiresAtMs: 999_999,
    status,
    baseReward: 100,
  };
}

function stateWith(statuses: RequestStatus[], over: Partial<GameState> = {}): GameState {
  return {
    levelIndex: 1,
    config: cfg,
    clockMs: 0,
    earnings: 0,
    cities: [],
    ships: [],
    requests: statuses.map(req),
    npcOffers: [],
    nextNpcRefreshMs: 999_999,
    outcome: 'playing' as Outcome,
    seed: 1,
    seq: 0,
    events: [],
    ...over,
  };
}

describe('summarizeShift', () => {
  it('counts each terminal request status into its own bucket', () => {
    const s = stateWith(
      ['delivered', 'delivered', 'delivered', 'expired', 'expired', 'assigned', 'active'],
      { earnings: 4200, outcome: 'won' },
    );
    const sum = summarizeShift(s);
    expect(sum.delivered).toBe(3);
    expect(sum.expired).toBe(2);
    expect(sum.inTransit).toBe(1); // 'assigned' = aboard a ship still in flight at the bell
    expect(sum.unclaimed).toBe(1); // 'active' = posted but never picked up
    expect(sum.posted).toBe(7);
    expect(sum.banked).toBe(4200);
    expect(sum.threshold).toBe(1000);
    expect(sum.won).toBe(true);
  });

  it("ignores 'scheduled' orders that never went live (posted excludes them)", () => {
    const s = stateWith(['scheduled', 'scheduled', 'delivered', 'expired']);
    const sum = summarizeShift(s);
    expect(sum.posted).toBe(2); // only the two that became active count as posted
    expect(sum.delivered).toBe(1);
    expect(sum.expired).toBe(1);
  });

  it('completionRate is delivered / (delivered + expired), ignoring in-transit and unclaimed', () => {
    // 3 delivered, 1 expired → 3/4; the 'assigned'/'active' orders don't dilute the rate
    const sum = summarizeShift(stateWith(['delivered', 'delivered', 'delivered', 'expired', 'assigned', 'active']));
    expect(sum.completionRate).toBeCloseTo(0.75, 10);
  });

  it('completionRate is 0 when nothing reached a verdict (avoids divide-by-zero)', () => {
    expect(summarizeShift(stateWith([])).completionRate).toBe(0);
    expect(summarizeShift(stateWith(['active', 'assigned', 'scheduled'])).completionRate).toBe(0);
  });

  it('reflects a perfect shift (everything delivered → 100%)', () => {
    const sum = summarizeShift(stateWith(['delivered', 'delivered'], { earnings: 900, outcome: 'lost' }));
    expect(sum.completionRate).toBe(1);
    expect(sum.expired).toBe(0);
    expect(sum.won).toBe(false); // banked under threshold even with a clean board
  });

  it('a do-nothing shift banks nothing, delivers nothing, and rates 0% (matches the sim)', () => {
    const s = createGameState(1);
    while (s.outcome === 'playing') step(s, 1000);
    const sum = summarizeShift(s);
    expect(sum.posted).toBeGreaterThan(0); // orders were generated
    expect(sum.delivered).toBe(0);
    expect(sum.inTransit).toBe(0); // no ship ever flew
    // none banked → the board is whatever lapsed plus whatever was still live at the bell
    expect(sum.expired + sum.unclaimed).toBe(sum.posted);
    expect(sum.expired).toBeGreaterThan(0); // early orders do lapse within the 2-min shift
    expect(sum.completionRate).toBe(0);
    expect(sum.banked).toBe(0);
    expect(sum.won).toBe(false);
  });
});
