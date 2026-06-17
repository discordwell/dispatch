# Architecture — Dispatch

A zeppelin dispatcher game set in the cyber-world of the Zybourne Clock. Client-only static web
game (TypeScript + Vite, Vitest for tests), deployed to `dispatch.discordwell.com`. See
`GAME_DESIGN.md` for the design and `claudepad.md` for session memory.

## Layering rule (load-bearing)

```
data/  ─┐
core/  ─┴─►  state/  ─►  engine/  ─►  render/ + ui/   (DOM/Canvas)
(pure)       (single mutable GameState)               (views + intents)
```

- **`core/` + `data/` are pure and deterministic** — zero DOM, zero canvas, zero `engine` imports.
  This is a self-contained game library, unit-tested with Vitest.
- **`state/`** owns the single mutable `GameState`; exposes `getState`, `subscribe`, `tick(dt)`,
  and `actions` (the only way to mutate).
- **`engine/loop.ts`** drives simulation time (fixed-timestep rAF).
- **`render/` (Canvas)** and **`ui/` (DOM/CSS)** are read-only *views* that emit *intents* up
  through `actions`. Data flows down; intents flow up.

**Why:** difficulty never branches on level number inside `core/`. Gameplay is pure functions
parameterized by `LevelConfig`, so "5 levels" is genuinely just data.

## Module map

| Path | Role | Pure? |
|------|------|:----:|
| `src/config.ts` | global tunables (tick rate, payout curve, speeds) | ✓ |
| `src/core/types.ts` | domain interfaces (City [=dock], Airship, Route/RouteStop, CargoLot/Hold, DeliveryRequest, PolyominoItem, Placement, GameState, LevelConfig) | ✓ |
| `src/core/rng.ts` | mulberry32 seeded PRNG | ✓ |
| `src/core/geometry.ts` | distance, travelTimeMs, multi-stop polyline position, nearest-neighbour visiting order | ✓ |
| `src/core/polyomino.ts` | rotate90 / flip / normalize / orientedCells / bbox | ✓ |
| `src/core/packing.ts` | derived occupancy grid, canPlace, fillRatio, pieceAt | ✓ |
| `src/core/payout.ts` | loaded value + efficiency (fill) bonus | ✓ |
| `src/core/requestGen.ts` | seeded request schedule from LevelConfig | ✓ |
| `src/core/sim.ts` | `step(state, dtMs)`: movement, stop resolution, spawn/expiry, money, win/lose; charter market | ✓ |
| `src/core/setup.ts` | `createGameState(levelIndex)` — fresh deterministic state | ✓ |
| `src/core/autopack.ts` | greedy first-fit packer for tests + balance runs (not a player feature) | ✓ |
| `src/state/store.ts` | holds GameState; subscribe/getState/advance/flush/update/reset | – |
| `src/state/actions.ts` | intents: beginLoad / commitLoad / cancelLoad / reposition / bookNpc, splitNet, buildMilkRun + read selectors | – |
| `src/state/progress.ts` | campaign progress (unlocks, best earnings) in localStorage; pure `applyResult` | – |
| `src/engine/loop.ts` | rAF fixed-timestep accumulator | – |
| `src/render/MapRenderer.ts` | Canvas: city-map raster (+white knockout), multi-stop routes, docks, airships | – |
| `src/render/paint.ts` | procedural brass/parchment/glow draw helpers | – |
| `src/render/viewport.ts` | world↔screen transform; where a ship is drawn (fan-out at docks) | – |
| `src/render/hitTest.ts` | which city/ship is under a world-space point (topmost ship wins) | – |
| `src/render/effects.ts` | transient feedback: payout float-ups, delivery rings, fee floats | – |
| `src/ui/GameUI.ts` | top-level controller: selection, campaign flow, canvas clicks, per-frame sync | – |
| `src/ui/Hud.ts` | money, shift clock, threshold progress | – |
| `src/ui/RequestBoard.ts` | dock board: orders here + incoming; Load Cargo + Hire-charter actions | – |
| `src/ui/ShipInspector.ts` | ship status / multi-stop route / cargo / next-stop ETA / send-to-dock | – |
| `src/ui/PackingOverlay.ts` | the cargo puzzle: grid, click-to-carry pieces, rotate/flip, live tray | – |
| `src/ui/TitleScreen.ts` | level-select grid (locked/unlocked, best scores) | – |
| `src/ui/ResultOverlay.ts` | win/lose (and campaign-complete) end-of-shift screen | – |
| `src/ui/flavor.ts` | verbatim Zybourne quotes / loading lines | – |
| `src/ui/format.ts` | money/clock/countdown formatting | ✓ |
| `src/ui/shapeGlyph.ts` | tiny SVG glyph of a polyomino for the boards | ✓ |
| `src/audio.ts` | procedural WebAudio SFX (no assets), mute persisted | – |
| `src/main.ts` | bootstrap: store + loop + renderer + GameUI; `__dispatch` debug handle | – |
| `src/data/cities.ts` | dock catalog (a `City` models a dock; superset for all levels) | ✓ |
| `src/data/shapes.ts` | polyomino library, tiered by difficulty | ✓ |
| `src/data/ships.ts` | ship classes (Scout 4×4, Hauler 5×6, Leviathan 6×8) + charter costs | ✓ |
| `src/data/levels/*` | the five tuned `LevelConfig`s (difficulty is data, never code) | ✓ |

## Time model

`engine/loop.ts` runs `requestAnimationFrame` with a **fixed-timestep accumulator**
(`config.TICK_HZ`). The simulation advances in fixed steps (deterministic, replayable,
unit-testable); rendering interpolates. A single frame's `dt` is clamped to
`config.MAX_FRAME_DT_MS` so a backgrounded tab doesn't mass-expire requests on return.

The level clock is **simulation time** counted inside `sim.step` (per-level `durationMs`, a tight
2–6 min shift rising one minute per ace). Because
it's sim-time and the packing overlay is merely a DOM layer, **time keeps running while you pack** —
ships keep flying and requests keep expiring. That tension is the core of the game and falls out
of the architecture for free (the loop has no concept of "a modal is open").

## Rendering split

- **Canvas** (one full-bleed layer, `z-map`) — the live map: the **Zybourne City raster** (its flat
  white surround knocked out at load so the sepia panel shows through), brass frame, multi-stop routes,
  dock nodes, moving airships, glow. Immediate-mode redraw suits ≤12 moving sprites.
- **DOM/CSS** (`z-panels`, `z-overlay`) — HUD, dock boards, ship inspector, and the packing
  overlay. Pointer Events + CSS transforms give accessible, GPU-composited drag/rotate/flip.

**Painterly steampunk:** the world map is a hand-drawn raster framed by procedural brass (Canvas
gradients for metal/glow, a load-time vignette settling the raster into the surround). Dock label
plates are dark + brass-edged for legibility over the colorful map. UI chrome stays asset-free.

## Packing engine

Polyominoes are normalized `Cell[]` sets. `rotate90: (x,y)→(y,−x)`; `flip: (x,y)→(−x,y)`; both
re-normalize (translate to origin + sort) so equality/dedup is well-defined. Hold occupancy is a
`Uint8Array(w*h)` **derived on demand** from `placements` (never stored stale). `canPlace` checks
bounds + overlap. Payout = loaded value + `BONUS_MAX·smoothstep(fill, FILL_FLOOR, 1)`, then the NPC
fee for booked ships. Partial loads are allowed; choosing the best-value subset is the puzzle.
In the overlay a piece can be **placed**, **lifted** (click a placed piece to pick it up and
reposition), or **removed** back to the manifest three ways — its ✕ badge, right-click, or the
**Clear** button (empty the whole hold). Lift and remove share one pure, unit-tested hit-test,
`core/packing.pieceAt(placements, items, cell)`, which resolves the placed piece under a cell.

## Map & multi-load milk-run

- **Map:** the world is the **Zybourne City** raster (`src/assets/zybourne-city.png`) — a 1416×1111
  **text-free** render (the original's baked-in district labels were removed via ChatGPT; dock names
  now come solely from the brass nameplates), drawn by `paint.paintCityMap` **scaled into** the
  `MAP_W×MAP_H` = **765×600** map-unit rect inside the procedural brass frame.
  `MapRenderer.knockOutWhiteBackground` flood-fills the raster's flat white surround to transparent at
  load (edge-contiguous from the borders, so interior whites survive) and the sepia panel shows behind
  the city silhouette. Map units stay 765×600 — dock coordinates live in that space; the higher-res
  asset just renders crisper. The 12 nodes in `data/cities.ts` are **docks** over the districts, each
  **named for the locale it sits in** (e.g. Tenement Junction in the slums, Market Cross in the
  commercial district); the `City` type / `cityId` are unchanged internally (a "city" now models a dock).
- **Loading is dock-scoped, not request-scoped.** `beginLoad(dockId, shipId)` reserves a ship to load a
  dock; `PackingOverlay` offers every active order at that dock, grouped/colored by destination, and the
  player packs any subset into one hold. `commitLoad(shipId, placements)` groups placements by request
  into `CargoLot`s, computes the whole-hold payout once and `splitNet`s it across lots by value, then
  dispatches. Orders are NOT frozen while loading (time never pauses); commit re-validates and drops any
  order that expired or was taken by another ship mid-pack, dispatching the valid remainder.
  Order **lifetimes** (`spawn.expiryMs`) are tuned long (min ≥ 60s, scaling up on the lower levels) and
  per-level `maxConcurrent` rises with them (6→10 across the campaign), so several orders stay live across
  docks at once — the raw material a multi-stop load batches. A `levels.test` guard pins the minimum
  lifetime so a future tweak can't quietly shrink windows back to where batching dies.
- **Multi-stop route.** `buildMilkRun` orders the lots' distinct destinations nearest-neighbour from the
  dock via the pure, unit-tested `geometry.nearestNeighbourOrder` (greedy hop, deterministic id
  tie-break), prepending a non-crediting **pickup stop** when the ship isn't already
  there (so any idle ship can load any dock, and charters fly in). `Route.stops[]` carries per-stop
  arrival times at one cruise speed, so a single `routeProgress` over the full `routePolyline` positions
  the ship. `sim.advanceStops` credits each stop reached this tick exactly once (auto-unloading the lots
  due there, one `deliver` event per stop) and idles the ship at the final drop — where it can load again.
- **Chartered ("contract") ships** are a paid capacity boost. `refreshNpcOffers` posts a long-lived
  market (`NPC_OFFER_REFRESH_MS`): a few demand docks each offer a random subset of hull sizes
  (`shuffled`, seeded) at a **fixed hire cost by size** (`ShipClass.charterCost`; bigger = pricier).
  The board lists each as a "Hire ⟨size⟩ §cost" button. `bookNpc` spawns the chosen hull; `commitLoad`
  deducts the fixed cost from `earnings` once on dispatch (owned ships are free) and the lots pay gross —
  so a charter only profits on a full multi-load. There is no percentage fee.
- **Reposition** (`actions.reposition`): an idle owned ship can be sent empty to a dock to pre-position it
  (worthwhile because cruising is slow). It flies a one-stop `purpose:'reposition'` route with no hold and
  idles on arrival (the `advanceStops` no-hold path — no payout, no events; owned, so the reaper skips it).
  `GameUI` drives a one-shot "Send to dock" mode (banner + Esc); the next dock click repositions.
- **Cruise speed is per level** (`LevelConfig.shipSpeed`, ramping down across the campaign); charters fly
  `config.CHARTER_SPEED_MULT`× faster. `buildMilkRun`/`reposition` read it; all legs of a route share one speed.

## Campaign, feedback & audio (full game)

- **Campaign flow** lives in `GameUI`: `TitleScreen` (level-select grid) → shift → `ResultOverlay`
  (win/lose, or a "Five Aces" campaign-complete variant). `state/progress.ts` persists unlocked
  tier + best earnings to `localStorage` (pure `applyResult` is unit-tested; load/save wrap it).
  The loop is gated by `GameUI.isRunning()` so sim time only advances during a shift.
- **Multi-ship:** `PackingOverlay` shows ship-selector chips; switching cancels the current
  reservation and re-reserves the chosen idle owned ship (`GameUI.switchShip`), re-keying the hold.
- **Feedback channel:** `sim.step` appends transient `GameState.events` (`deliver`/`expire`);
  `GameUI.sync` drains them each frame into `render/effects.ts` (payout float-ups, delivery rings)
  and `audio.ts` SFX. City badges pulse when a request is about to expire. `events` is capped so
  headless runs that never drain it don't grow unbounded.
- **Audio (`audio.ts`):** procedural WebAudio blips, no asset files; lazily created and resumed on
  a user gesture (autoplay policy); mute persisted. Added modules: `src/audio.ts`,
  `src/render/effects.ts`, `src/state/progress.ts`, `src/ui/TitleScreen.ts`.

## Build & deploy

`npm run build` → `tsc --noEmit` typecheck + Vite bundle to `dist/`. `scripts/deploy.sh` rsyncs
`dist/` to `ovh2:/opt/dispatch/site/` (SSH port 41022) and installs
`deploy/Caddyfile.dispatch.discordwell.com` to `/etc/caddy/sites/` + reloads Caddy. The root
Caddyfile already `import`s `/etc/caddy/sites/*`. Hashed `assets/*` are cached immutable;
`index.html` is `no-cache`. Requires DNS A record `dispatch.discordwell.com → 15.204.59.61`.

## Testing

Pure `core/` is unit-tested with Vitest in the `node` env (fast, no jsdom). The drag UI is
verified by browser **wet testing** (per CLAUDE.md), not unit tests. Per "every fix requires a
test", bug-prone geometry/packing math lives in pure tested functions.
