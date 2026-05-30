import { describe, it, expect } from 'vitest';
import { step } from '../src/core/sim';
import { createGameState } from '../src/core/setup';
import { bookNpc, commitPack } from '../src/state/actions';
import { autoPack } from '../src/core/autopack';
import type { DeliveryRequest, GameState, LevelConfig, NpcOffer, PolyominoItem } from '../src/core/types';

const cfg: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'npc-test',
  durationMs: 600_000,
  threshold: 1000,
  cityIds: ['a', 'b'],
  ownedShips: [],
  npc: { enabled: true, feeFraction: 0.3, spawnDistance: 100 },
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

const domino = (id: string): PolyominoItem => ({ id, value: 100, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });

function stateWithOffer(): GameState {
  const req: DeliveryRequest = {
    id: 'r1',
    originId: 'a',
    destId: 'b',
    items: [domino('r1_0'), domino('r1_1')],
    spawnAtMs: 0,
    expiresAtMs: 999_999,
    status: 'active',
    baseReward: 200,
  };
  const offer: NpcOffer = {
    id: 'o1',
    shipClass: 'Scout',
    holdW: 4,
    holdH: 4,
    spawn: { x: 50, y: 50 },
    nearCityId: 'a',
    feeFraction: 0.3,
  };
  return {
    levelIndex: 1,
    config: cfg,
    clockMs: 0,
    earnings: 0,
    cities: [
      { id: 'a', name: 'A', x: 0, y: 0 },
      { id: 'b', name: 'B', x: 100, y: 0 },
    ],
    ships: [],
    requests: [req],
    npcOffers: [offer],
    nextNpcRefreshMs: 999_999,
    outcome: 'playing',
    seed: 1,
    seq: 0,
    events: [],
  };
}

describe('npc charters', () => {
  it('createGameState seeds a charter roster for npc-enabled levels', () => {
    const s = createGameState(1);
    expect(s.npcOffers.length).toBeGreaterThan(0);
    for (const o of s.npcOffers) {
      expect(o.feeFraction).toBeCloseTo(s.config.npc.feeFraction);
      expect(s.cities.some((c) => c.id === o.nearCityId)).toBe(true);
    }
  });

  it('bookNpc spawns a non-owned ship, consumes the offer, and begins packing', () => {
    const s = stateWithOffer();
    const id = bookNpc(s, 'o1', 'r1');
    expect(id).toMatch(/^npc-o1-\d+$/);
    expect(s.npcOffers).toHaveLength(0);
    const ship = s.ships.find((sh) => sh.id === id)!;
    expect(ship.owned).toBe(false);
    expect(ship.status).toBe('loading');
    expect(s.requests[0]!.status).toBe('assigned');
  });

  it('a booked charter pays out minus its fee, then departs after delivering', () => {
    const s = stateWithOffer();
    const id = bookNpc(s, 'o1', 'r1')!;
    const ship = s.ships.find((sh) => sh.id === id)!;
    const placements = autoPack(ship.holdW, ship.holdH, s.requests[0]!.items);
    expect(commitPack(s, 'r1', id, placements)).toBe(true);
    // loaded 200, fill 4/16 < floor → no bonus → gross 200, fee 30% → net 140
    expect(ship.cargo!.payout).toBe(140);
    step(s, 60_000); // plenty of time to fly spawn→origin→dest
    expect(s.earnings).toBe(140);
    expect(s.requests[0]!.status).toBe('delivered');
    expect(s.ships.find((sh) => sh.id === id)).toBeUndefined(); // charter departed
  });

  it('re-booking a regenerated offer id never destroys a live charter (C1 regression)', () => {
    const s = stateWithOffer();
    // book + dispatch the first charter (now flying)
    const id1 = bookNpc(s, 'o1', 'r1')!;
    const ship1 = s.ships.find((sh) => sh.id === id1)!;
    expect(commitPack(s, 'r1', id1, autoPack(ship1.holdW, ship1.holdH, s.requests[0]!.items))).toBe(true);
    expect(ship1.status).toBe('flying');

    // a roster refresh regenerates the SAME offer id while the charter is still in flight
    s.requests.push({
      id: 'r2',
      originId: 'a',
      destId: 'b',
      items: [domino('r2_0')],
      spawnAtMs: 0,
      expiresAtMs: 999_999,
      status: 'active',
      baseReward: 100,
    });
    s.npcOffers.push({
      id: 'o1', // same id as the consumed offer
      shipClass: 'Scout',
      holdW: 4,
      holdH: 4,
      spawn: { x: 60, y: 60 },
      nearCityId: 'a',
      feeFraction: 0.3,
    });

    const id2 = bookNpc(s, 'o1', 'r2');
    if (id2) expect(id2).not.toBe(id1); // distinct ship, no collision
    // the original in-flight charter must survive and still pay out
    expect(s.ships.some((sh) => sh.id === id1 && sh.status === 'flying')).toBe(true);
    step(s, 60_000);
    expect(s.earnings).toBeGreaterThanOrEqual(140);
  });
});
