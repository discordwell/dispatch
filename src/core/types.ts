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

// 'repositioning' is reserved (nothing sets it yet — deadheading is a real pickup stop now).
export type ShipStatus = 'idle' | 'loading' | 'flying' | 'repositioning';

/** One stop on a multi-stop route: a dock the ship reaches at a known time. */
export interface RouteStop {
  cityId: CityId;
  pos: Vec2; // dock position, denormalized so geometry needs no dock lookup
  arriveAtMs: number; // absolute clock time the ship reaches this stop
}

export interface Route {
  /** Loading dock the trip began at, or null when departing a free map point (charter spawn). */
  originId: CityId | null;
  from: Vec2;
  /** Ordered delivery stops; the last is the final dock where the ship idles. */
  stops: RouteStop[];
  /** First not-yet-reached stop; equals stops.length once every stop has been delivered. */
  nextStopIndex: number;
  departedAtMs: number;
  arriveAtMs: number; // == stops.at(-1).arriveAtMs (whole-trip end)
  purpose: 'deliver' | 'reposition';
}

/** One request's contribution to a combined hold, auto-unloaded at its destination dock. */
export interface CargoLot {
  requestId: string;
  destId: CityId;
  items: PolyominoItem[]; // the subset of this request actually loaded
  payout: number; // this lot's net share, credited when the ship reaches destId
}

/** The combined contents of a ship's hold: one or more lots packed into a single grid. */
export interface Hold {
  placements: Placement[]; // all placed pieces across every lot (whole-hold geometry)
  lots: CargoLot[];
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
  /** Free-map position; authoritative while flying/repositioning, else mirrors the dock. */
  pos: Vec2;
  route?: Route;
  /** Dock whose orders are on offer; set while status === 'loading'. */
  loadingDockId?: CityId;
  hold?: Hold;
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
