/**
 * Central tunables. Balancing and feel live here so tweaks are a one-file edit,
 * never a refactor. Level-specific knobs live in data/levels/* instead.
 */
export const config = {
  // --- Simulation clock ---
  TICK_HZ: 20, // fixed simulation ticks per second
  MAX_FRAME_DT_MS: 250, // clamp a single frame's dt so tab-throttle doesn't mass-expire requests

  // --- Map / motion (map units == Zybourne City map pixels: 765x600) ---
  MAP_W: 765,
  MAP_H: 600,
  SHIP_SPEED: 48, // owned-ship cruise speed, map units per second (a measured pace over the city)
  NPC_SPEED: 56, // chartered ships fly a little faster

  // --- Payout ---
  BONUS_MAX: 0.5, // efficiency bonus caps at +50% of loaded value on a perfectly full hold
  FILL_FLOOR: 0.5, // bonus stays 0 below this fill ratio, then ramps (smoothstep) to 1.0

  // --- Request board presentation ---
  UPCOMING_PEEK: 3, // how many not-yet-active requests a city board previews

  // --- Chartered ("contract") ships ---
  NPC_OFFER_REFRESH_MS: 75_000, // contract offers linger this long before the market rotates
  NPC_MARKET_DOCKS: 3, // how many docks host a charter market at once
  NPC_MAX_SIZES_PER_DOCK: 2, // distinct hull sizes offered at a dock (you choose from what's there)
} as const;

export type Config = typeof config;
