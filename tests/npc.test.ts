import { describe, it, expect } from 'vitest';
import { step } from '../src/core/sim';
import { createGameState } from '../src/core/setup';
import { bookNpc, commitLoad } from '../src/state/actions';
import { autoPack } from '../src/core/autopack';
import { getShipClass } from '../src/data/ships';
import type { DeliveryRequest, GameState, LevelConfig, NpcOffer, PolyominoItem } from '../src/core/types';

const cfg: LevelConfig = {
  index: 1,
  rank: '♠',
  name: 'npc-test',
  durationMs: 600_000,
  threshold: 1000,
  shipSpeed: 48,
  cityIds: ['a', 'b'],
  ownedShips: [],
  npc: { enabled: true, spawnDistance: 100 },
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
    cost: 350,
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
      expect(o.cost).toBe(getShipClass(o.shipClass).charterCost);
      expect(o.cost).toBeGreaterThan(0);
      expect(s.cities.some((c) => c.id === o.nearCityId)).toBe(true);
    }
  });

  it('bookNpc spawns a non-owned ship, consumes the offer, and begins loading', () => {
    const s = stateWithOffer();
    const id = bookNpc(s, 'o1', 'a');
    expect(id).toMatch(/^npc-o1-\d+$/);
    expect(s.npcOffers).toHaveLength(0);
    const ship = s.ships.find((sh) => sh.id === id)!;
    expect(ship.owned).toBe(false);
    expect(ship.status).toBe('loading');
    expect(ship.loadingDockId).toBe('a');
    expect(s.requests[0]!.status).toBe('active'); // loading doesn't freeze the order
  });

  it('a charter charges a fixed fee on dispatch, pays gross on delivery — a small load loses money', () => {
    const s = stateWithOffer();
    const id = bookNpc(s, 'o1', 'a')!;
    const ship = s.ships.find((sh) => sh.id === id)!;
    expect(ship.charterCost).toBe(350); // Scout
    const placements = autoPack(ship.holdW, ship.holdH, s.requests[0]!.items);
    expect(commitLoad(s, id, placements)).toBe(true);
    // sparse hold → no bonus → the lot pays gross 200; the §350 hire is charged on dispatch
    expect(ship.hold!.lots[0]!.payout).toBe(200);
    expect(s.earnings).toBe(-350); // fee deducted immediately, before any delivery
    step(s, 60_000); // fly spawn → pickup → drop
    expect(s.earnings).toBe(-150); // 200 gross − 350 hire: one small order isn't worth a charter
    expect(s.requests[0]!.status).toBe('delivered');
    expect(s.ships.find((sh) => sh.id === id)).toBeUndefined(); // charter departed
  });

  it('a charter turns a profit once you fill it with a multi-load', () => {
    const s = stateWithOffer();
    // a second order at the same dock lets us fill the hull
    s.requests.push({
      id: 'r2',
      originId: 'a',
      destId: 'b',
      items: [domino('r2_0'), domino('r2_1')],
      spawnAtMs: 0,
      expiresAtMs: 999_999,
      status: 'active',
      baseReward: 200,
    });
    const id = bookNpc(s, 'o1', 'a')!;
    const ship = s.ships.find((sh) => sh.id === id)!;
    const items = [...s.requests[0]!.items, ...s.requests[1]!.items]; // 4 dominoes = 400 value
    expect(commitLoad(s, id, autoPack(ship.holdW, ship.holdH, items))).toBe(true);
    step(s, 60_000);
    expect(s.earnings).toBe(50); // 400 gross − 350 hire
  });

  it('re-booking a regenerated offer id never destroys a live charter (C1 regression)', () => {
    const s = stateWithOffer();
    // book + dispatch the first charter (now flying)
    const id1 = bookNpc(s, 'o1', 'a')!;
    const ship1 = s.ships.find((sh) => sh.id === id1)!;
    expect(commitLoad(s, id1, autoPack(ship1.holdW, ship1.holdH, s.requests[0]!.items))).toBe(true);
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
      cost: 350,
    });

    const id2 = bookNpc(s, 'o1', 'a');
    if (id2) expect(id2).not.toBe(id1); // distinct ship, no collision
    // the original in-flight charter must survive the re-booking and complete its run
    expect(s.ships.some((sh) => sh.id === id1 && sh.status === 'flying')).toBe(true);
    step(s, 60_000);
    expect(s.requests.find((r) => r.id === 'r1')!.status).toBe('delivered');
  });
});
