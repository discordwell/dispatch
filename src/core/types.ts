/**
 * The central domain contract. Every layer depends on these types; nothing here
 * depends on the DOM, canvas, or the engine. Pure data.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Integer grid coordinate inside a cargo hold or a polyomino's local frame. */
export type Cell = { x: number; y: number };

/** 90° rotation steps. */
export type Rotation = 0 | 1 | 2 | 3;

export type CityId = string;

export interface City {
  id: CityId;
  name: string;
  x: number; // map units
  y: number;
}

/** A cargo item: an oddly-shaped polyomino with a delivery value. */
export interface PolyominoItem {
  id: string;
  /** Base orientation, normalized so min(x) = min(y) = 0. */
  cells: Cell[];
  value: number;
  label?: string;
}

/** One item placed on a hold grid. */
export interface Placement {
  itemId: string;
  rot: Rotation;
  flipped: boolean;
  /** Top-left anchor of the oriented piece on the hold grid. */
  origin: Cell;
}

/** A working or committed pack of a request into a specific ship's hold. */
export interface PackingState {
  shipId: string;
  requestId: string;
  w: number;
  h: number;
  placements: Placement[];
}

export interface ShipClass {
  name: string;
  holdW: number;
  holdH: number;
}

export type ShipStatus = 'idle' | 'loading' | 'flying' | 'repositioning';

export interface Route {
  /** Origin city, or null when departing a free map point (NPC repositioning). */
  originId: CityId | null;
  destId: CityId;
  from: Vec2;
  /** Optional pickup waypoint: the ship deadheads here (the request origin) before the load leg. */
  via?: Vec2;
  to: Vec2;
  departedAtMs: number;
  arriveAtMs: number;
  purpose: 'deliver' | 'reposition';
}

/** Cargo committed to a ship and carried in flight. */
export interface CargoManifest {
  requestId: string;
  placements: Placement[];
  items: PolyominoItem[]; // the subset actually loaded
  payout: number; // net payout credited on arrival
}

export interface Airship {
  id: string;
  shipClass: string; // references a ShipClass.name
  owned: boolean;
  feeFraction: number; // 0 for owned ships; the booking cut for NPC ships
  holdW: number;
  holdH: number;
  status: ShipStatus;
  /** Set when idle/loading at a city. */
  locationId: CityId | null;
  /** Free-map position; authoritative while flying/repositioning, else mirrors the city. */
  pos: Vec2;
  route?: Route;
  assignedRequestId?: string;
  cargo?: CargoManifest;
}

export type RequestStatus = 'scheduled' | 'active' | 'assigned' | 'delivered' | 'expired';

export interface DeliveryRequest {
  id: string;
  originId: CityId;
  destId: CityId;
  items: PolyominoItem[];
  spawnAtMs: number;
  expiresAtMs: number;
  status: RequestStatus;
  /** Sum of item values, before efficiency bonus / fees. */
  baseReward: number;
}

/** A bookable NPC ship, hovering near (not on) a city until hired. */
export interface NpcOffer {
  id: string;
  shipClass: string;
  holdW: number;
  holdH: number;
  spawn: Vec2;
  nearCityId: CityId;
  feeFraction: number;
}

export interface SpawnConfig {
  firstAtMs: number;
  /** [min, max] gap between request spawns, sampled per spawn. */
  intervalMs: [number, number];
  maxConcurrent: number;
  /** [min, max] lifetime of an active request before it expires. */
  expiryMs: [number, number];
  itemsPerRequest: [number, number];
  /** Which shape tiers (data/shapes) are eligible. */
  shapeTiers: number[];
  valuePerCell: [number, number];
}

export interface NpcConfig {
  enabled: boolean;
  feeFraction: number;
  spawnDistance: number; // map units from the served city
}

export interface LevelConfig {
  index: number;
  rank: string; // "♠".."♠♠♠♠♠"
  name: string;
  durationMs: number;
  threshold: number;
  cityIds: CityId[];
  ownedShips: { shipClass: string }[];
  npc: NpcConfig;
  spawn: SpawnConfig;
  seed: number;
}

export type Outcome = 'playing' | 'won' | 'lost';

/** Transient one-frame signals emitted by the sim for UI feedback (drained each frame). */
export type GameEvent =
  | { type: 'deliver'; cityId: CityId; amount: number }
  | { type: 'expire'; cityId: CityId };

export interface GameState {
  levelIndex: number;
  config: LevelConfig;
  clockMs: number; // simulation time, 0..durationMs
  earnings: number;
  cities: City[];
  ships: Airship[];
  requests: DeliveryRequest[]; // all: scheduled + active + resolved
  npcOffers: NpcOffer[];
  nextNpcRefreshMs: number;
  outcome: Outcome;
  seed: number;
  seq: number; // monotonic counter for deterministic id generation
  events: GameEvent[]; // transient UI feedback signals; drained by the UI each frame
}
