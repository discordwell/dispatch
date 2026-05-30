import type { City, CityId } from '../core/types';

/**
 * The city catalog — a superset across all levels. Coordinates are in map units
 * (config.MAP_W × MAP_H ≈ 1000×680), kept off the edges. Each level picks a subset
 * via LevelConfig.cityIds. Names lean into the Zybourne Clock's brass/clock world.
 */
export const CITIES: readonly City[] = [
  { id: 'zybourne', name: 'Zybourne', x: 500, y: 338 }, // central hub — fleet home
  { id: 'clockhaven', name: 'Clockhaven', x: 322, y: 250 },
  { id: 'tickmoor', name: 'Tickmoor', x: 690, y: 246 },
  { id: 'nimbus-wharf', name: 'Nimbus Wharf', x: 498, y: 104 },
  { id: 'aetherhaven', name: 'Aetherhaven', x: 168, y: 138 },
  { id: 'brassholm', name: 'Brassholm', x: 836, y: 150 },
  { id: 'cogsworth', name: 'Cogsworth', x: 150, y: 470 },
  { id: 'gearford', name: 'Gearford', x: 852, y: 498 },
  { id: 'sprocket-bay', name: 'Sprocket Bay', x: 318, y: 576 },
  { id: 'mainspring', name: 'Mainspring', x: 706, y: 596 },
  { id: 'escapement', name: 'Escapement', x: 918, y: 332 },
  { id: 'fiveaces-landing', name: 'Fiveaces Landing', x: 110, y: 318 },
] as const;

const BY_ID = new Map<CityId, City>(CITIES.map((c) => [c.id, c]));

export function getCity(id: CityId): City {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown city: ${id}`);
  return c;
}

export function cityExists(id: CityId): boolean {
  return BY_ID.has(id);
}
