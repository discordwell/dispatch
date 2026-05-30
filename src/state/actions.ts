import { config } from '../config';
import { pathLength, travelTimeMs } from '../core/geometry';
import { buildOccupancy, fillRatio } from '../core/packing';
import { computePayout, loadedValue } from '../core/payout';
import { autoPack } from '../core/autopack';
import type {
  Airship,
  City,
  DeliveryRequest,
  GameState,
  NpcOffer,
  Placement,
  PolyominoItem,
  Route,
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
function itemMap(req: DeliveryRequest): Map<string, PolyominoItem> {
  return new Map(req.items.map((i) => [i.id, i]));
}

// ── selectors (used by UI) ─────────────────────────────────────────────────────
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
/** Reserve a request + ship for packing (request becomes immune to expiry). */
export function beginPack(s: GameState, requestId: string, shipId: string): boolean {
  const req = findRequest(s, requestId);
  const ship = findShip(s, shipId);
  if (!req || !ship) return false;
  if (req.status !== 'active') return false;
  if (ship.status !== 'idle') return false;
  req.status = 'assigned';
  ship.status = 'loading';
  ship.assignedRequestId = requestId;
  return true;
}

/** Abandon an in-progress pack; the request returns to active (or expires if its window closed). */
export function cancelPack(s: GameState, requestId: string, shipId: string): void {
  const req = findRequest(s, requestId);
  const ship = findShip(s, shipId);
  if (ship && ship.status === 'loading') {
    ship.status = 'idle';
    delete ship.assignedRequestId;
  }
  if (req && req.status === 'assigned') {
    req.status = s.clockMs < req.expiresAtMs ? 'active' : 'expired';
  }
}

/** Finalize a pack and dispatch the ship. Returns false if the pack is invalid or empty. */
export function commitPack(
  s: GameState,
  requestId: string,
  shipId: string,
  placements: Placement[],
): boolean {
  const req = findRequest(s, requestId);
  const ship = findShip(s, shipId);
  if (!req || !ship) return false;
  if (ship.status !== 'loading' || ship.assignedRequestId !== requestId) return false;
  if (placements.length === 0) return false;
  // reject the same item placed twice (the UI prevents it, but this is a public action)
  if (new Set(placements.map((p) => p.itemId)).size !== placements.length) return false;

  const items = itemMap(req);
  const { occupied, ok } = buildOccupancy(ship.holdW, ship.holdH, placements, items);
  if (!ok) return false;

  const loaded = loadedValue(placements, items);
  const fill = fillRatio(ship.holdW, ship.holdH, occupied);
  const pay = computePayout({ loaded, fill, owned: ship.owned, feeFraction: ship.feeFraction });
  const loadedItems = placements
    .map((p) => items.get(p.itemId))
    .filter((x): x is PolyominoItem => Boolean(x));

  ship.route = buildRoute(s, ship, req, s.clockMs);
  ship.status = 'flying';
  ship.locationId = null;
  ship.cargo = {
    requestId,
    placements: placements.map((p) => ({ ...p, origin: { ...p.origin } })),
    items: loadedItems,
    payout: pay.net,
  };
  // request stays 'assigned' until delivery flips it to 'delivered'
  return true;
}

function buildRoute(s: GameState, ship: Airship, req: DeliveryRequest, now: number): Route {
  const origin = findCity(s, req.originId);
  const dest = findCity(s, req.destId);
  const from = { x: ship.pos.x, y: ship.pos.y };
  const to = dest ? { x: dest.x, y: dest.y } : from;
  const atOrigin = ship.locationId === req.originId;
  const via = !atOrigin && origin ? { x: origin.x, y: origin.y } : undefined;
  const speed = ship.owned ? config.SHIP_SPEED : config.NPC_SPEED;
  const dur = travelTimeMs(pathLength(from, via, to), speed);
  return {
    originId: req.originId,
    destId: req.destId,
    from,
    via,
    to,
    departedAtMs: now,
    arriveAtMs: now + dur,
    purpose: 'deliver',
  };
}

/**
 * Hire a charter for a request: spawn a non-owned ship at the offer's hover point,
 * consume the offer, and begin packing. Returns the new ship id (or null if invalid).
 */
export function bookNpc(s: GameState, offerId: string, requestId: string): string | null {
  const offer = s.npcOffers.find((o) => o.id === offerId);
  const req = findRequest(s, requestId);
  if (!offer || !req || req.status !== 'active') return null;
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
  if (!beginPack(s, requestId, ship.id)) {
    s.ships = s.ships.filter((sh) => sh !== ship); // roll back by reference, never by id
    return null;
  }
  return ship.id;
}

/**
 * Scaffold/headless helper: reserve + greedily auto-pack + dispatch in one call.
 * NOT a player feature — the game is hand-packed. Used by the M4 stub and tests.
 */
export function autoAssign(s: GameState, requestId: string, shipId: string): boolean {
  const req = findRequest(s, requestId);
  if (!req) return false;
  if (!beginPack(s, requestId, shipId)) return false;
  const ship = findShip(s, shipId);
  if (!ship) return false;
  const placements = autoPack(ship.holdW, ship.holdH, req.items);
  if (placements.length === 0) {
    cancelPack(s, requestId, shipId);
    return false;
  }
  return commitPack(s, requestId, shipId, placements);
}
