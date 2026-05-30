import { config } from '../config';
import { SHIP_CLASSES } from '../data/ships';
import { polylinePosition, routePolyline, routeProgress } from './geometry';
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
      s.events.push({ type: 'expire', cityId: r.originId });
    }
  }

  // Refresh the charter roster on schedule.
  if (now >= s.nextNpcRefreshMs) {
    refreshNpcOffers(s);
    s.nextNpcRefreshMs += config.NPC_OFFER_REFRESH_MS;
  }

  // Move ships and resolve any stops reached this tick.
  for (const ship of s.ships) {
    const route = ship.route;
    if (!route || (ship.status !== 'flying' && ship.status !== 'repositioning')) continue;
    const t = routeProgress(route.departedAtMs, route.arriveAtMs, now);
    ship.pos = polylinePosition(routePolyline(route.from, route.stops), t);
    advanceStops(s, ship, now);
  }

  // Booked charters are one-delivery: once they finish (idle, no route), they depart.
  if (s.ships.some((sh) => !sh.owned && sh.status === 'idle' && !sh.route)) {
    s.ships = s.ships.filter((sh) => sh.owned || sh.status !== 'idle' || !!sh.route);
  }

  // Cap the transient event buffer in case the UI isn't draining (headless runs).
  if (s.events.length > 120) s.events.splice(0, s.events.length - 120);

  if (s.clockMs >= s.config.durationMs) {
    s.outcome = s.earnings >= s.config.threshold ? 'won' : 'lost';
  }
}

/**
 * Resolve every route stop reached since the last tick. A fast ship + large dt can pass
 * several stops at once, so we loop: at each stop, auto-unload the lots due there (credit
 * the payout, mark the request delivered, emit one deliver event), advancing a cursor that
 * never mutates the stop list (so the position calc keeps using the full polyline). When
 * the final stop is reached the ship idles there and the trip is cleared.
 */
function advanceStops(s: GameState, ship: Airship, now: number): void {
  const route = ship.route;
  if (!route) return;

  while (route.nextStopIndex < route.stops.length && route.stops[route.nextStopIndex]!.arriveAtMs <= now) {
    const stop = route.stops[route.nextStopIndex]!;
    route.nextStopIndex++;

    if (ship.hold) {
      let dropped = 0;
      for (const lot of ship.hold.lots) {
        if (lot.destId !== stop.cityId) continue;
        s.earnings += lot.payout;
        dropped += lot.payout;
        const req = s.requests.find((r) => r.id === lot.requestId);
        if (req) req.status = 'delivered';
      }
      ship.hold.lots = ship.hold.lots.filter((l) => l.destId !== stop.cityId);
      // suppress 0-payout events (e.g. the non-crediting pickup stop)
      if (dropped > 0) s.events.push({ type: 'deliver', cityId: stop.cityId, amount: dropped });
    }
  }

  if (route.nextStopIndex >= route.stops.length) {
    const last = route.stops[route.stops.length - 1];
    ship.status = 'idle';
    if (last) {
      ship.locationId = last.cityId;
      const city = s.cities.find((c) => c.id === last.cityId);
      ship.pos = city ? { x: city.x, y: city.y } : { x: last.pos.x, y: last.pos.y };
    }
    delete ship.route;
    delete ship.hold;
  }
}
