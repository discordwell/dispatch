import type { City, CityId } from '../core/types';

/**
 * The dock catalog — a superset across all levels. A `City` now models a DOCK
 * inside Zybourne City (the fiction is intra-city dispatch). Coordinates are in
 * map units == pixels of the city map (config.MAP_W × MAP_H = 765 × 600), placed
 * over the map's districts. Each level picks a subset via LevelConfig.cityIds;
 * the first id is the fleet's home dock. Names lean into the map's districts.
 */
export const CITIES: readonly City[] = [
  { id: 'loading-bay', name: 'Loading Bay', x: 370, y: 455 }, // the harbor docks — fleet home
  { id: 'clocktower-plaza', name: 'Clocktower Plaza', x: 370, y: 285 }, // central crossroads
  { id: 'the-slums', name: 'The Slums', x: 150, y: 300 },
  { id: 'commercial-quay', name: 'Commercial Quay', x: 105, y: 405 },
  { id: 'uptown-heights', name: 'Uptown Heights', x: 135, y: 50 },
  { id: 'cog-junction', name: 'Cog Junction', x: 320, y: 115 },
  { id: 'garrison-keep', name: 'Garrison Keep', x: 560, y: 210 }, // Castle/Military District
  { id: 'sprocket-row', name: 'Sprocket Row', x: 645, y: 330 },
  { id: 'gearford-wall', name: 'Gearford Wall', x: 560, y: 440 },
  { id: 'brass-gate', name: 'Brass Gate', x: 710, y: 250 }, // east perimeter gate
  { id: 'aether-pier', name: 'Aether Pier', x: 490, y: 505 }, // harbor, east of the loading bay
  { id: 'tinkers-end', name: "Tinker's End", x: 55, y: 320 }, // far-west edge
] as const;

const BY_ID = new Map<CityId, City>(CITIES.map((c) => [c.id, c]));

export function getCity(id: CityId): City {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown dock: ${id}`);
  return c;
}

export function cityExists(id: CityId): boolean {
  return BY_ID.has(id);
}
