import { config } from '../config';
import { getLevel } from '../data/levels';
import { getCity } from '../data/cities';
import { getShipClass } from '../data/ships';
import { generateRequests } from './requestGen';
import { refreshNpcOffers } from './sim';
import type { Airship, City, GameState } from './types';

/** Build a fresh, deterministic GameState for a level. Owned ships start at the hub (first city). */
export function createGameState(levelIndex: number): GameState {
  const level = getLevel(levelIndex);
  const cities: City[] = level.cityIds.map(getCity);
  const hub = cities[0];
  if (!hub) throw new Error(`Level ${levelIndex} has no cities`);

  const ships: Airship[] = level.ownedShips.map((o, i) => {
    const cls = getShipClass(o.shipClass);
    return {
      id: `ship${i + 1}`,
      shipClass: cls.name,
      owned: true,
      charterCost: 0,
      holdW: cls.holdW,
      holdH: cls.holdH,
      status: 'idle',
      locationId: hub.id,
      pos: { x: hub.x, y: hub.y },
    };
  });

  const state: GameState = {
    levelIndex: level.index,
    config: level,
    clockMs: 0,
    earnings: 0,
    cities,
    ships,
    requests: generateRequests(level, cities),
    npcOffers: [],
    nextNpcRefreshMs: config.NPC_OFFER_REFRESH_MS,
    outcome: 'playing',
    seed: level.seed,
    seq: 0,
    events: [],
  };
  refreshNpcOffers(state); // seed the initial charter roster at clock 0
  return state;
}
