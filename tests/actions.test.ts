import { describe, it, expect } from 'vitest';
import { beginLoad, commitLoad, bookNpc, reposition, splitNet } from '../src/state/actions';
import { step } from '../src/core/sim';
import type {
  Airship,
  DeliveryRequest,
  GameState,
  LevelConfig,
  NpcOffer,
  Placement,
  PolyominoItem,
} from '../src/core/types';

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

/** A horizontal 2-cell domino. */
function domino(id: string, value = 100): PolyominoItem {
  return { id, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }], value };
}

function activeReq(id: string, originId: string, destId: string, items: PolyominoItem[]): DeliveryRequest {
  return {
    id,
    originId,
    destId,
    items,
    spawnAtMs: 0,
    expiresAtMs: 999_999,
    status: 'active',
    baseReward: items.reduce((n, it) => n + it.value, 0),
  };
}

function haulerAt(locId: string, x: number, y: number): Airship {
  return {
    id: 's1',
    shipClass: 'Hauler',
    owned: true,
    charterCost: 0,
    holdW: 5,
    holdH: 6,
    status: 'idle',
    locationId: locId,
    pos: { x, y },
  };
}

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    levelIndex: 1,
    config: cfg,
    clockMs: 0,
    earnings: 0,
    cities: [
      { id: 'd', name: 'Dock', x: 0, y: 0 },
      { id: 'a', name: 'A', x: 100, y: 0 },
      { id: 'b', name: 'B', x: 0, y: 100 },
      { id: 'c', name: 'C', x: 300, y: 0 },
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

const place = (itemId: string, x: number, y: number): Placement => ({
  itemId,
  rot: 0,
  flipped: false,
  origin: { x, y },
});

describe('splitNet', () => {
  it('sums to net and hands the remainder to the largest fractional parts', () => {
    expect(splitNet(200, [100, 100])).toEqual([100, 100]);
    expect(splitNet(141, [100, 100])).toEqual([71, 70]);
    expect(splitNet(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitNet(50, [100, 0])).toEqual([50, 0]);
    expect(splitNet(7, [10])).toEqual([7]);
    expect(splitNet(0, [5, 5])).toEqual([0, 0]);
    expect(splitNet(9, [])).toEqual([]);
  });

  it('always sums to net across assorted inputs', () => {
    const cases: [number, number[]][] = [
      [133, [50, 30, 20]],
      [97, [1, 2, 3, 4]],
      [1000, [7, 7, 7]],
      [13, [5, 5, 5, 5]],
    ];
    for (const [net, vals] of cases) {
      expect(splitNet(net, vals).reduce((a, b) => a + b, 0)).toBe(net);
    }
  });
});

describe('commitLoad', () => {
  it('groups placements from several orders into per-destination lots', () => {
    const r1 = activeReq('r1', 'd', 'a', [domino('r1_0', 100)]);
    const r2 = activeReq('r2', 'd', 'b', [domino('r2_0', 100)]);
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship], requests: [r1, r2] });

    expect(beginLoad(s, 'd', 's1')).toBe(true);
    expect(commitLoad(s, 's1', [place('r1_0', 0, 0), place('r2_0', 0, 2)])).toBe(true);

    expect(ship.status).toBe('flying');
    expect(ship.hold!.lots).toHaveLength(2);
    const byReq = Object.fromEntries(ship.hold!.lots.map((l) => [l.requestId, l]));
    expect(byReq['r1']!.destId).toBe('a');
    expect(byReq['r2']!.destId).toBe('b');
    // fill 4/30 < FILL_FLOOR → no bonus; net 200; split evenly; shares sum to net
    expect(ship.hold!.lots.reduce((n, l) => n + l.payout, 0)).toBe(200);
    expect(byReq['r1']!.payout).toBe(100);
    expect(r1.status).toBe('assigned');
    expect(r2.status).toBe('assigned');
    // ship is AT dock 'd' → no pickup stop; NN from (0,0): a & b tie at 100 → 'a' first
    expect(ship.route!.stops.map((st) => st.cityId)).toEqual(['a', 'b']);
  });

  it('leaves unloaded dock orders active and routes only to loaded destinations', () => {
    const r1 = activeReq('r1', 'd', 'a', [domino('r1_0', 100)]);
    const r3 = activeReq('r3', 'd', 'c', [domino('r3_0', 100)]);
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship], requests: [r1, r3] });
    beginLoad(s, 'd', 's1');
    expect(commitLoad(s, 's1', [place('r1_0', 0, 0)])).toBe(true);
    expect(r3.status).toBe('active'); // untouched — nothing of r3 was packed
    expect(ship.route!.stops.map((st) => st.cityId)).toEqual(['a']);
  });

  it('prepends a non-crediting pickup stop when the ship is not at the dock', () => {
    const r1 = activeReq('r1', 'd', 'a', [domino('r1_0', 100)]);
    const ship = haulerAt('c', 300, 0); // idle elsewhere → must deadhead to 'd'
    const s = baseState({ ships: [ship], requests: [r1] });
    beginLoad(s, 'd', 's1');
    commitLoad(s, 's1', [place('r1_0', 0, 0)]);
    expect(ship.route!.stops.map((st) => st.cityId)).toEqual(['d', 'a']);
  });

  it('orders three drops nearest-neighbour from the dock, not by raw distance from it', () => {
    // Docks placed so greedy NN (a → b → c) differs from a naive distance-from-dock sort
    // (a 30, c 40, b 60 → a, c, b). Pins the milk-run router through the public action.
    const ship = haulerAt('d', 0, 0);
    const s = baseState({
      cities: [
        { id: 'd', name: 'Dock', x: 0, y: 0 },
        { id: 'a', name: 'A', x: 30, y: 0 },
        { id: 'b', name: 'B', x: 60, y: 0 },
        { id: 'c', name: 'C', x: 0, y: 40 },
      ],
      ships: [ship],
      requests: [
        activeReq('ra', 'd', 'a', [domino('ra_0')]),
        activeReq('rb', 'd', 'b', [domino('rb_0')]),
        activeReq('rc', 'd', 'c', [domino('rc_0')]),
      ],
    });
    beginLoad(s, 'd', 's1');
    expect(commitLoad(s, 's1', [place('ra_0', 0, 0), place('rb_0', 0, 2), place('rc_0', 0, 4)])).toBe(true);
    expect(ship.route!.stops.map((st) => st.cityId)).toEqual(['a', 'b', 'c']);
  });

  it('rejects empty, duplicate, foreign, and overlapping placements', () => {
    const mk = (): GameState => {
      const ship = haulerAt('d', 0, 0);
      const s = baseState({
        ships: [ship],
        requests: [activeReq('r1', 'd', 'a', [domino('r1_0'), domino('r1_1')])],
      });
      beginLoad(s, 'd', 's1');
      return s;
    };
    expect(commitLoad(mk(), 's1', [])).toBe(false);
    expect(commitLoad(mk(), 's1', [place('r1_0', 0, 0), place('r1_0', 0, 2)])).toBe(false); // dup
    expect(commitLoad(mk(), 's1', [place('ghost', 0, 0)])).toBe(false); // foreign item
    expect(commitLoad(mk(), 's1', [place('r1_0', 0, 0), place('r1_1', 0, 0)])).toBe(false); // overlap
  });

  it('refuses an order whose destination is the dock itself (no pickup/delivery collision)', () => {
    const r = activeReq('rx', 'd', 'd', [domino('rx_0', 100)]); // degenerate dest === origin
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship], requests: [r] });
    beginLoad(s, 'd', 's1');
    expect(commitLoad(s, 's1', [place('rx_0', 0, 0)])).toBe(false); // its item isn't loadable
  });

  it('drops items already taken by another ship and dispatches the valid remainder', () => {
    const r1 = activeReq('r1', 'd', 'a', [domino('r1_0', 100)]);
    const r2 = activeReq('r2', 'd', 'b', [domino('r2_0', 100)]);
    const shipA = haulerAt('d', 0, 0);
    const shipB: Airship = { ...haulerAt('d', 0, 0), id: 's2' };
    const s = baseState({ ships: [shipA, shipB], requests: [r1, r2] });
    beginLoad(s, 'd', 's1');
    beginLoad(s, 'd', 's2'); // both load the same dock
    expect(commitLoad(s, 's1', [place('r1_0', 0, 0)])).toBe(true); // A takes r1 → 'assigned'
    expect(r1.status).toBe('assigned');
    // B's pack still references the now-taken r1_0 plus a fresh r2_0 → r1_0 dropped, r2 dispatched
    expect(commitLoad(s, 's2', [place('r1_0', 0, 0), place('r2_0', 0, 2)])).toBe(true);
    expect(shipB.hold!.lots).toHaveLength(1);
    expect(shipB.hold!.lots[0]!.requestId).toBe('r2');
    expect(r2.status).toBe('assigned');
  });

  it('splits the whole-hold payout across lots in proportion to each order’s loaded value', () => {
    const r1 = activeReq('r1', 'd', 'a', [domino('r1_0', 300)]);
    const r2 = activeReq('r2', 'd', 'b', [domino('r2_0', 100)]);
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship], requests: [r1, r2] });
    beginLoad(s, 'd', 's1');
    expect(commitLoad(s, 's1', [place('r1_0', 0, 0), place('r2_0', 0, 2)])).toBe(true);
    const byReq = Object.fromEntries(ship.hold!.lots.map((l) => [l.requestId, l.payout]));
    expect(byReq['r1']).toBe(300); // owned, no bonus → net 400 split 300/100 by value
    expect(byReq['r2']).toBe(100);
    expect(byReq['r1']! + byReq['r2']!).toBe(400);
  });
});

describe('bookNpc', () => {
  it('spawns a charter at a dock and begins loading', () => {
    const offer: NpcOffer = {
      id: 'o1',
      shipClass: 'Scout',
      holdW: 4,
      holdH: 4,
      spawn: { x: 60, y: 60 },
      nearCityId: 'd',
      cost: 350,
    };
    const s = baseState({ npcOffers: [offer] });
    const id = bookNpc(s, 'o1', 'd');
    expect(id).toMatch(/^npc-o1-\d+$/);
    expect(s.npcOffers).toHaveLength(0);
    const sh = s.ships.find((x) => x.id === id)!;
    expect(sh.owned).toBe(false);
    expect(sh.status).toBe('loading');
    expect(sh.loadingDockId).toBe('d');
  });
});

describe('reposition', () => {
  it('sends an idle owned ship empty to a dock, idling there on arrival', () => {
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship] });
    expect(reposition(s, 's1', 'a')).toBe(true);
    expect(ship.status).toBe('repositioning');
    expect(ship.route!.purpose).toBe('reposition');
    expect(ship.route!.stops.map((st) => st.cityId)).toEqual(['a']);
    expect(ship.hold).toBeUndefined(); // flies empty — no cargo, no payout
    step(s, 60_000);
    expect(ship.status).toBe('idle');
    expect(ship.locationId).toBe('a');
    expect(s.earnings).toBe(0);
  });

  it('a repositioned owned ship is never reaped and emits no events', () => {
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship] });
    reposition(s, 's1', 'a');
    step(s, 60_000);
    expect(s.ships.some((sh) => sh.id === 's1')).toBe(true); // owned → the charter-reaper skips it
    expect(s.events).toHaveLength(0); // flew empty: no deliver/expire
  });

  it('rejects a charter, a busy ship, an unknown dock, or a no-op move', () => {
    const ship = haulerAt('d', 0, 0);
    const s = baseState({ ships: [ship] });
    expect(reposition(s, 's1', 'nope')).toBe(false); // unknown dock
    expect(reposition(s, 's1', 'd')).toBe(false); // already there
    ship.owned = false;
    expect(reposition(s, 's1', 'a')).toBe(false); // charters can't be repositioned
    ship.owned = true;
    ship.status = 'flying';
    expect(reposition(s, 's1', 'a')).toBe(false); // busy
  });
});
