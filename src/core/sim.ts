import { config } from '../config';
import { SHIP_CLASSES } from '../data/ships';
import { pathPosition, routeProgress } from './geometry';
import { makeRng, pick } from './rng';
import type { Airship, GameState, NpcOffer } from './types';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Regenerate the bookable-charter roster. Offers cluster near cities that currently
 * have demand (active requests), hovering a fixed distance off the city. Deterministic
 * per time-bucket so a given seed + clock yields the same roster.
 */
export function refreshNpcOffers(s: GameState): void {
  if (!s.config.npc.enabled) {
    s.npcOffers = [];
    return;
  }
  const bucket = Math.floor(s.clockMs / config.NPC_OFFER_REFRESH_MS);
  const rng = makeRng((((s.seed ^ (bucket * 0x9e3779b1)) >>> 0) || 1) >>> 0);
  const withDemand = s.cities.filter((c) =>
    s.requests.some((r) => r.status === 'active' && r.originId === c.id),
  );
  const pool = withDemand.length ? withDemand : s.cities;
  const classes = Object.values(SHIP_CLASSES);
  const offers: NpcOffer[] = [];
  const used = new Set<string>();
  const count = Math.min(config.NPC_MAX_OFFERS, pool.length);
  for (let i = 0; i < count; i++) {
    let city = pick(rng, pool);
    for (let g = 0; g < 8 && used.has(city.id); g++) city = pick(rng, pool);
    used.add(city.id);
    const cls = pick(rng, classes);
    const ang = rng() * Math.PI * 2;
    const d = s.config.npc.spawnDistance;
    offers.push({
      id: `npc${bucket}_${i}`,
      shipClass: cls.name,
      holdW: cls.holdW,
      holdH: cls.holdH,
      spawn: {
        x: clamp(city.x + Math.cos(ang) * d, 40, config.MAP_W - 40),
        y: clamp(city.y + Math.sin(ang) * d, 40, config.MAP_H - 40),
      },
      nearCityId: city.id,
      feeFraction: s.config.npc.feeFraction,
    });
  }
  s.npcOffers = offers;
}

/**
 * Advance the simulation by `dtMs`. Pure and deterministic. The clock is clamped to
 * the shift duration, so a delivery only counts if it arrives on or before the
 * deadline — anything still in flight at the bell is lost. Crucially, this has no
 * concept of "a packing overlay is open": time always moves, which is the game's
 * central pressure.
 */
export function step(s: GameState, dtMs: number): void {
  if (s.outcome !== 'playing') return;

  const now = Math.min(s.clockMs + dtMs, s.config.durationMs);
  s.clockMs = now;

  // Request lifecycle. (assigned / delivered requests are immune to expiry.)
  for (const r of s.requests) {
    if (r.status === 'scheduled' && r.spawnAtMs <= now) {
      r.status = r.expiresAtMs <= now ? 'expired' : 'active';
    } else if (r.status === 'active' && r.expiresAtMs <= now) {
      r.status = 'expired';
    }
  }

  // Refresh the charter roster on schedule.
  if (now >= s.nextNpcRefreshMs) {
    refreshNpcOffers(s);
    s.nextNpcRefreshMs += config.NPC_OFFER_REFRESH_MS;
  }

  // Move ships and resolve arrivals.
  for (const ship of s.ships) {
    const route = ship.route;
    if (!route || (ship.status !== 'flying' && ship.status !== 'repositioning')) continue;
    const t = routeProgress(route.departedAtMs, route.arriveAtMs, now);
    ship.pos = pathPosition(route.from, route.via, route.to, t);
    if (now >= route.arriveAtMs) arrive(s, ship);
  }

  // Booked charters are one-delivery: once they finish (idle, no route), they depart.
  if (s.ships.some((sh) => !sh.owned && sh.status === 'idle' && !sh.route)) {
    s.ships = s.ships.filter((sh) => sh.owned || sh.status !== 'idle' || !!sh.route);
  }

  if (s.clockMs >= s.config.durationMs) {
    s.outcome = s.earnings >= s.config.threshold ? 'won' : 'lost';
  }
}

function arrive(s: GameState, ship: Airship): void {
  const route = ship.route;
  if (!route) return;

  if (route.purpose === 'deliver' && ship.cargo) {
    s.earnings += ship.cargo.payout;
    const req = s.requests.find((r) => r.id === ship.cargo?.requestId);
    if (req) req.status = 'delivered';
  }

  const dest = s.cities.find((c) => c.id === route.destId);
  ship.status = 'idle';
  ship.locationId = route.destId;
  if (dest) ship.pos = { x: dest.x, y: dest.y };
  delete ship.route;
  delete ship.cargo;
  delete ship.assignedRequestId;
}
