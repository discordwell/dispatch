import { describe, it, expect } from 'vitest';
import { step, refreshNpcOffers } from '../src/core/sim';
import { createGameState } from '../src/core/setup';
import { bookNpc, commitLoad } from '../src/state/actions';
import { autoPack } from '../src/core/autopack';
import { getShipClass } from '../src/data/ships';
import { config } from '../src/config';
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

describe('refreshNpcOffers (charter market generation)', () => {
  function marketState(over: Partial<GameState> = {}): GameState {
    return {
      levelIndex: 1,
      config: { ...cfg, npc: { enabled: true, spawnDistance: 120 } },
      clockMs: 0,
      earnings: 0,
      cities: [
        { id: 'a', name: 'A', x: 100, y: 100 },
        { id: 'b', name: 'B', x: 300, y: 120 },
        { id: 'c', name: 'C', x: 500, y: 300 },
        { id: 'd', name: 'D', x: 220, y: 420 },
        { id: 'e', name: 'E', x: 600, y: 500 },
      ],
      ships: [],
      requests: [],
      npcOffers: [],
      nextNpcRefreshMs: 999_999,
      outcome: 'playing',
      seed: 1, // chosen so the roster posts a multi-size dock (else the distinctness check is vacuous)
      seq: 0,
      events: [],
      ...over,
    };
  }

  it('seeds a roster when enabled and clears it when disabled', () => {
    const s = marketState();
    refreshNpcOffers(s);
    expect(s.npcOffers.length).toBeGreaterThan(0);
    s.config = { ...s.config, npc: { enabled: false, spawnDistance: 120 } };
    refreshNpcOffers(s);
    expect(s.npcOffers).toEqual([]);
  });

  it('is deterministic for a given seed and time bucket', () => {
    const a = marketState();
    const b = marketState();
    refreshNpcOffers(a);
    refreshNpcOffers(b);
    expect(a.npcOffers).toEqual(b.npcOffers);
    expect(a.npcOffers.length).toBeGreaterThan(0);
  });

  it('offers distinct, class-priced hulls at a capped number of real docks, inside the map', () => {
    const s = marketState();
    refreshNpcOffers(s);
    const offers = s.npcOffers;
    expect(new Set(offers.map((o) => o.nearCityId)).size).toBeLessThanOrEqual(config.NPC_MARKET_DOCKS);
    for (const o of offers) {
      expect(s.cities.some((c) => c.id === o.nearCityId)).toBe(true);
      expect(o.cost).toBe(getShipClass(o.shipClass).charterCost);
      expect(o.holdW).toBe(getShipClass(o.shipClass).holdW);
      expect(o.holdH).toBe(getShipClass(o.shipClass).holdH);
      expect(o.spawn.x).toBeGreaterThanOrEqual(40);
      expect(o.spawn.x).toBeLessThanOrEqual(config.MAP_W - 40);
      expect(o.spawn.y).toBeGreaterThanOrEqual(40);
      expect(o.spawn.y).toBeLessThanOrEqual(config.MAP_H - 40);
    }
    // each dock posts a DISTINCT subset of hull sizes, capped per dock
    const byDock = new Map<string, string[]>();
    for (const o of offers) byDock.set(o.nearCityId, [...(byDock.get(o.nearCityId) ?? []), o.shipClass]);
    for (const classes of byDock.values()) {
      expect(classes.length).toBeLessThanOrEqual(config.NPC_MAX_SIZES_PER_DOCK);
      expect(new Set(classes).size).toBe(classes.length);
    }
    // and the seed must actually exercise a multi-size dock, or the distinctness check above is
    // vacuous (every dock having one hull trivially satisfies it).
    expect([...byDock.values()].some((classes) => classes.length >= 2)).toBe(true);
  });

  it('hosts the market only at docks with active demand when any exists', () => {
    const s = marketState({
      requests: [
        {
          id: 'r1',
          originId: 'c',
          destId: 'a',
          items: [domino('r1_0')],
          spawnAtMs: 0,
          expiresAtMs: 999_999,
          status: 'active',
          baseReward: 100,
        },
      ],
    });
    refreshNpcOffers(s);
    expect(s.npcOffers.length).toBeGreaterThan(0);
    for (const o of s.npcOffers) expect(o.nearCityId).toBe('c'); // only 'c' has an active order
  });
});
