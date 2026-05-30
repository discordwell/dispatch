import { describe, it, expect } from 'vitest';
import { step } from '../src/core/sim';
import { createGameState } from '../src/core/setup';
import { autoAssign, activeRequests, idleShips } from '../src/state/actions';
import type { Airship, DeliveryRequest, GameState, LevelConfig } from '../src/core/types';

const baseConfig: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'test',
  durationMs: 600_000,
  threshold: 1000,
  cityIds: ['a', 'b'],
  ownedShips: [],
  npc: { enabled: false, feeFraction: 0, spawnDistance: 0 },
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

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    levelIndex: 1,
    config: baseConfig,
    clockMs: 0,
    earnings: 0,
    cities: [
      { id: 'a', name: 'A', x: 0, y: 0 },
      { id: 'b', name: 'B', x: 100, y: 0 },
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

function flyingShip(payout: number, arriveAtMs: number): Airship {
  return {
    id: 's1',
    shipClass: 'Hauler',
    owned: true,
    feeFraction: 0,
    holdW: 5,
    holdH: 6,
    status: 'flying',
    locationId: null,
    pos: { x: 0, y: 0 },
    route: {
      originId: 'a',
      destId: 'b',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      departedAtMs: 0,
      arriveAtMs,
      purpose: 'deliver',
    },
    cargo: { requestId: 'r1', placements: [], items: [], payout },
  };
}

describe('sim.step', () => {
  it('credits a delivery exactly once on arrival', () => {
    const s = baseState({
      ships: [flyingShip(500, 1000)],
      requests: [
        {
          id: 'r1',
          originId: 'a',
          destId: 'b',
          items: [],
          spawnAtMs: 0,
          expiresAtMs: 999_999,
          status: 'assigned',
          baseReward: 500,
        },
      ],
    });
    step(s, 1000);
    expect(s.earnings).toBe(500);
    expect(s.ships[0]!.status).toBe('idle');
    expect(s.ships[0]!.locationId).toBe('b');
    expect(s.requests[0]!.status).toBe('delivered');
    // no double credit on subsequent ticks
    step(s, 1000);
    step(s, 1000);
    expect(s.earnings).toBe(500);
  });

  it('expires active requests at the boundary but spares assigned ones', () => {
    const active: DeliveryRequest = {
      id: 'a1',
      originId: 'a',
      destId: 'b',
      items: [],
      spawnAtMs: 0,
      expiresAtMs: 1000,
      status: 'active',
      baseReward: 100,
    };
    const assigned: DeliveryRequest = { ...active, id: 'a2', status: 'assigned' };
    const s = baseState({ requests: [active, assigned] });
    step(s, 1500);
    expect(s.requests[0]!.status).toBe('expired');
    expect(s.requests[1]!.status).toBe('assigned');
  });

  it('promotes scheduled requests to active when their spawn time arrives', () => {
    const sched: DeliveryRequest = {
      id: 'p1',
      originId: 'a',
      destId: 'b',
      items: [],
      spawnAtMs: 500,
      expiresAtMs: 5000,
      status: 'scheduled',
      baseReward: 100,
    };
    const s = baseState({ requests: [sched] });
    step(s, 200);
    expect(s.requests[0]!.status).toBe('scheduled');
    step(s, 400); // now at 600 >= 500
    expect(s.requests[0]!.status).toBe('active');
  });

  it('resolves win/lose against the threshold at the bell', () => {
    const won = baseState({ earnings: 1500 });
    step(won, 600_000);
    expect(won.outcome).toBe('won');

    const lost = baseState({ earnings: 500 });
    step(lost, 600_000);
    expect(lost.outcome).toBe('lost');
  });

  it('drops deliveries still in flight at the bell (clock clamps to duration)', () => {
    const s = baseState({ ships: [flyingShip(999, 600_500)] }); // arrives after the shift ends
    step(s, 600_000);
    expect(s.clockMs).toBe(600_000);
    expect(s.earnings).toBe(0);
    expect(s.outcome).toBe('lost');
  });

  it('is a no-op once the outcome is decided', () => {
    const s = baseState({ earnings: 2000 });
    step(s, 600_000);
    expect(s.outcome).toBe('won');
    const snapshot = s.earnings;
    step(s, 10_000);
    expect(s.earnings).toBe(snapshot);
  });

  it('emits a deliver event on arrival and an expire event when an active request lapses', () => {
    const del = baseState({
      ships: [flyingShip(500, 1000)],
      requests: [
        { id: 'r1', originId: 'a', destId: 'b', items: [], spawnAtMs: 0, expiresAtMs: 999_999, status: 'assigned', baseReward: 500 },
      ],
    });
    step(del, 1000);
    expect(del.events).toContainEqual({ type: 'deliver', cityId: 'b', amount: 500 });

    const exp = baseState({
      requests: [
        { id: 'a1', originId: 'a', destId: 'b', items: [], spawnAtMs: 0, expiresAtMs: 1000, status: 'active', baseReward: 100 },
      ],
    });
    step(exp, 1500);
    expect(exp.events).toContainEqual({ type: 'expire', cityId: 'a' });
  });
});

describe('level 1 end-to-end (headless policy)', () => {
  it('is winnable by a reasonable greedy policy', () => {
    const s = createGameState(1);
    let guard = 0;
    while (s.outcome === 'playing' && guard++ < 100_000) {
      const idle = idleShips(s);
      const active = activeRequests(s).sort((a, b) => b.baseReward - a.baseReward);
      if (idle[0] && active[0]) autoAssign(s, active[0].id, idle[0].id);
      step(s, 100);
    }
    expect(s.outcome).toBe('won');
    expect(s.earnings).toBeGreaterThanOrEqual(s.config.threshold);
  });

  it('is lost by doing nothing', () => {
    const s = createGameState(1);
    while (s.outcome === 'playing') step(s, 1000);
    expect(s.outcome).toBe('lost');
    expect(s.earnings).toBe(0);
  });
});
