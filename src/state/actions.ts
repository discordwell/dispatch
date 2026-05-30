import { config } from '../config';
import { cumulativeLengths, distance, travelTimeMs } from '../core/geometry';
import { buildOccupancy, fillRatio } from '../core/packing';
import { computePayout, loadedValue } from '../core/payout';
import { autoPack } from '../core/autopack';
import type {
  Airship,
  CargoLot,
  City,
  DeliveryRequest,
  GameState,
  NpcOffer,
  Placement,
  PolyominoItem,
  Route,
  RouteStop,
} from '../core/types';

// ── lookups ──────────────────────────────────────────────────────────────────
function findShip(s: GameState, id: string): Airship | undefined {
  return s.ships.find((x) => x.id === id);
}
function findRequest(s: GameState, id: string): DeliveryRequest | undefined {
  return s.requests.find((x) => x.id === id);
}
function findCity(s: GameState, id: string): City | undefined {
  return s.cities.find((c) => c.id === id);
}

// ── selectors (used by UI + headless policy) ───────────────────────────────────
export function activeRequests(s: GameState): DeliveryRequest[] {
  return s.requests.filter((r) => r.status === 'active');
}
export function activeRequestsAt(s: GameState, cityId: string): DeliveryRequest[] {
  return s.requests.filter((r) => r.status === 'active' && r.originId === cityId);
}
export function upcomingRequestsAt(s: GameState, cityId: string, n: number): DeliveryRequest[] {
  return s.requests
    .filter((r) => r.status === 'scheduled' && r.originId === cityId && r.spawnAtMs > s.clockMs)
    .sort((a, b) => a.spawnAtMs - b.spawnAtMs)
    .slice(0, n);
}
export function idleShips(s: GameState): Airship[] {
  return s.ships.filter((sh) => sh.status === 'idle');
}
export function npcOfferNear(s: GameState, cityId: string): NpcOffer | undefined {
  return s.npcOffers.find((o) => o.nearCityId === cityId);
}

// ── intents ─────────────────────────────────────────────────────────────────
/**
 * Reserve a ship to load a dock. Loading is dock-scoped, not request-scoped: the player
 * can pack any subset of the dock's active orders into the one hold. Requests are NOT
 * frozen (the sim never pauses), so commitLoad re-validates against still-active orders.
 */
export function beginLoad(s: GameState, dockId: string, shipId: string): boolean {
  const ship = findShip(s, shipId);
  const dock = findCity(s, dockId);
  if (!ship || !dock) return false;
  if (ship.status !== 'idle') return false;
  ship.status = 'loading';
  ship.loadingDockId = dockId;
  return true;
}

/** Abandon an in-progress load; the ship returns to idle. No request statuses were changed. */
export function cancelLoad(s: GameState, shipId: string): void {
  const ship = findShip(s, shipId);
  if (ship && ship.status === 'loading') {
    ship.status = 'idle';
    delete ship.loadingDockId;
  }
}

/**
 * Finalize a load and dispatch the ship on a multi-stop milk-run. `placements` may mix
 * items from several of the dock's active orders; each contributing order becomes a lot,
 * auto-unloaded (and paid) when the ship reaches its destination. Returns false if the
 * pack is empty/invalid or references items not on offer at this dock.
 */
export function commitLoad(s: GameState, shipId: string, placements: Placement[]): boolean {
  const ship = findShip(s, shipId);
  if (!ship || ship.status !== 'loading' || !ship.loadingDockId) return false;
  const dockId = ship.loadingDockId;
  if (placements.length === 0) return false;
  // reject the same item placed twice (the UI prevents it, but this is a public action)
  if (new Set(placements.map((p) => p.itemId)).size !== placements.length) return false;

  // Index every item offered by an active order at this dock → its owning request.
  // Exclude any degenerate order whose destination IS the dock: its delivery stop would
  // collide with the pickup stop and mis-credit. (generateRequests never makes these.)
  const reqAtDock = s.requests.filter(
    (r) => r.status === 'active' && r.originId === dockId && r.destId !== dockId,
  );
  const owner = new Map<string, { item: PolyominoItem; req: DeliveryRequest }>();
  for (const r of reqAtDock) for (const it of r.items) owner.set(it.id, { item: it, req: r });

  // Drop any placed item that's no longer loadable here — an order that expired or was
  // taken by another ship mid-pack — and dispatch the valid remainder (the overlay
  // self-heals too). Bail only if nothing valid is left.
  const valid = placements.filter((p) => owner.has(p.itemId));
  if (valid.length === 0) return false;

  // validate the whole-hold packing against the ship's grid
  const allItems = new Map<string, PolyominoItem>([...owner].map(([id, v]) => [id, v.item]));
  const { occupied, ok } = buildOccupancy(ship.holdW, ship.holdH, valid, allItems);
  if (!ok) return false;

  // whole-hold payout — the efficiency bonus is computed once over the combined load
  const loaded = loadedValue(valid, allItems);
  const fill = fillRatio(ship.holdW, ship.holdH, occupied);
  const pay = computePayout({ loaded, fill, owned: ship.owned, feeFraction: ship.feeFraction });

  // group placements by request, summing each request's loaded value
  const groups = new Map<string, { req: DeliveryRequest; items: PolyominoItem[]; value: number }>();
  for (const p of valid) {
    const { item, req } = owner.get(p.itemId)!;
    const g = groups.get(req.id) ?? { req, items: [], value: 0 };
    g.items.push(item);
    g.value += item.value;
    groups.set(req.id, g);
  }

  // split the net payout proportionally to each request's loaded value (shares sum to net)
  const groupList = [...groups.values()];
  const shares = splitNet(pay.net, groupList.map((g) => g.value));
  const lots: CargoLot[] = groupList.map((g, i) => {
    g.req.status = 'assigned'; // immune to expiry now that it's committed to a ship
    return { requestId: g.req.id, destId: g.req.destId, items: g.items, payout: shares[i]! };
  });

  ship.route = buildMilkRun(s, ship, dockId, lots, s.clockMs);
  ship.hold = {
    placements: valid.map((p) => ({ ...p, origin: { ...p.origin } })),
    lots,
  };
  ship.status = 'flying';
  ship.locationId = null;
  delete ship.loadingDockId;
  return true;
}

/**
 * Split `net` across lots in proportion to `values`, handing the rounding remainder to the
 * largest fractional parts so the shares sum to exactly `net`. Deterministic (ties by index).
 */
export function splitNet(net: number, values: number[]): number[] {
  if (values.length === 0) return [];
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return values.map(() => 0);
  const raw = values.map((v) => (net * v) / total);
  const out = raw.map((r) => Math.floor(r));
  const remainder = net - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remainder && k < order.length; k++) out[order[k]!.i]!++;
  return out;
}

/**
 * Build a multi-stop delivery route over the lots' distinct destinations, ordered
 * nearest-neighbour from the loading dock (ties broken by id → deterministic). A
 * non-crediting pickup stop at the dock is prepended when the ship isn't already there,
 * so it deadheads in to collect. Per-stop arrival times accrue by cumulative arc length
 * at a single cruise speed (which is why a global routeProgress can place the ship).
 */
function buildMilkRun(s: GameState, ship: Airship, dockId: string, lots: CargoLot[], now: number): Route {
  const from = { x: ship.pos.x, y: ship.pos.y };
  // guard > 0 so travelTimeMs can't yield Infinity → NaN positions / a ship that never arrives
  const speed = Math.max(1, ship.owned ? config.SHIP_SPEED : config.NPC_SPEED);
  const dock = findCity(s, dockId);

  // nearest-neighbour order the distinct destinations, starting from the dock
  const destIds = [...new Set(lots.map((l) => l.destId))];
  const pool = destIds.map((id) => findCity(s, id)).filter((c): c is City => Boolean(c));
  let cursor = dock ? { x: dock.x, y: dock.y } : from;
  const orderedDests: City[] = [];
  while (pool.length) {
    pool.sort((a, b) => distance(cursor, a) - distance(cursor, b) || a.id.localeCompare(b.id));
    const next = pool.shift()!;
    orderedDests.push(next);
    cursor = { x: next.x, y: next.y };
  }

  // deadhead pickup stop at the dock if the ship isn't sitting there already
  const atDock = !!dock && ship.locationId === dockId;
  const stopCities: City[] = !dock || atDock ? orderedDests : [dock, ...orderedDests];

  const positions = stopCities.map((c) => ({ x: c.x, y: c.y }));
  const cum = cumulativeLengths([from, ...positions]);
  const stops: RouteStop[] = stopCities.map((c, k) => ({
    cityId: c.id,
    pos: positions[k]!,
    arriveAtMs: now + travelTimeMs(cum[k + 1]!, speed),
  }));

  return {
    originId: dockId,
    from,
    stops,
    nextStopIndex: 0,
    departedAtMs: now,
    arriveAtMs: stops.length ? stops[stops.length - 1]!.arriveAtMs : now,
    purpose: 'deliver',
  };
}

/**
 * Hire a charter to load a dock: spawn a non-owned ship at the offer's hover point,
 * consume the offer, and begin loading. Returns the new ship id (or null if invalid).
 */
export function bookNpc(s: GameState, offerId: string, dockId: string): string | null {
  const offer = s.npcOffers.find((o) => o.id === offerId);
  const dock = findCity(s, dockId);
  if (!offer || !dock) return null;
  // Globally-unique id: offer ids are bucket-deterministic and can be regenerated by a
  // roster refresh, so `npc-${offer.id}` alone would collide with a still-live charter.
  const ship: Airship = {
    id: `npc-${offer.id}-${s.seq++}`,
    shipClass: offer.shipClass,
    owned: false,
    feeFraction: offer.feeFraction,
    holdW: offer.holdW,
    holdH: offer.holdH,
    status: 'idle',
    locationId: null,
    pos: { x: offer.spawn.x, y: offer.spawn.y },
  };
  s.ships.push(ship);
  s.npcOffers = s.npcOffers.filter((o) => o.id !== offer.id);
  if (!beginLoad(s, dockId, ship.id)) {
    s.ships = s.ships.filter((sh) => sh !== ship); // roll back by reference, never by id
    return null;
  }
  return ship.id;
}

/**
 * Scaffold/headless helper: load a single request greedily and dispatch in one call.
 * NOT a player feature — the game is hand-packed. Used by tests and the balance model.
 * Produces a one-lot, one-destination milk-run (behaviourally the old single delivery).
 */
export function autoAssign(s: GameState, requestId: string, shipId: string): boolean {
  const req = findRequest(s, requestId);
  const ship = findShip(s, shipId);
  if (!req || !ship || req.status !== 'active') return false;
  if (!beginLoad(s, req.originId, shipId)) return false;
  const placements = autoPack(ship.holdW, ship.holdH, req.items);
  if (placements.length === 0) {
    cancelLoad(s, shipId);
    return false;
  }
  return commitLoad(s, shipId, placements);
}
