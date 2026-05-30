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
| `src/core/types.ts` | all domain interfaces (City, Airship, DeliveryRequest, PolyominoItem, Placement, PackingState, GameState, LevelConfig) | ✓ |
| `src/core/rng.ts` | mulberry32 seeded PRNG | ✓ |
| `src/core/geometry.ts` | distance, travelTimeMs, lerp-along-route | ✓ |
| `src/core/polyomino.ts` | rotate90 / flip / normalize / orientedCells / bbox | ✓ |
| `src/core/packing.ts` | derived occupancy grid, canPlace, fillRatio | ✓ |
| `src/core/payout.ts` | loaded value + efficiency bonus + NPC fee | ✓ |
| `src/core/requestGen.ts` | seeded request schedule from LevelConfig | ✓ |
| `src/core/sim.ts` | `step(state, dtMs)`: movement, ETAs, spawn/expiry, money, win/lose | ✓ |
| `src/state/store.ts` | holds GameState; subscribe/getState/tick | – |
| `src/state/actions.ts` | intents: assignRequest, bookNpc, commitPack, deliver… | – |
| `src/engine/loop.ts` | rAF fixed-timestep accumulator | – |
| `src/render/MapRenderer.ts` | Canvas: parchment map, routes, cities, airships | – |
| `src/render/paint.ts` | procedural brass/parchment/glow draw helpers | – |
| `src/render/hitTest.ts` | screen→world; which city/ship is under the cursor | – |
| `src/ui/Hud.ts` | money, shift clock, threshold progress | – |
| `src/ui/RequestBoard.ts` | city panel: current + upcoming requests | – |
| `src/ui/ShipInspector.ts` | ship status / cargo / ETA | – |
| `src/ui/PackingOverlay.ts` | the cargo puzzle: grid + draggable polyominoes | – |
| `src/ui/dragController.ts` | pointer drag/rotate/flip state machine | – |
| `src/ui/BookingDialog.ts` | book an NPC ship for a request | – |
| `src/ui/flavor.ts` | verbatim Zybourne quotes / loading lines | – |
| `src/data/cities.ts` | named city catalog (superset for all levels) | ✓ |
| `src/data/shapes.ts` | polyomino library, tiered by difficulty | ✓ |
| `src/data/ships.ts` | ship classes (Scout 4×4, Hauler 5×6, Leviathan 6×8) | ✓ |
| `src/data/levels/*` | `LevelConfig`s; level1 concrete, 2–5 stubs | ✓ |

## Time model

`engine/loop.ts` runs `requestAnimationFrame` with a **fixed-timestep accumulator**
(`config.TICK_HZ`). The simulation advances in fixed steps (deterministic, replayable,
unit-testable); rendering interpolates. A single frame's `dt` is clamped to
`config.MAX_FRAME_DT_MS` so a backgrounded tab doesn't mass-expire requests on return.

The level clock is **simulation time** counted inside `sim.step` (`durationMs = 600_000`). Because
it's sim-time and the packing overlay is merely a DOM layer, **time keeps running while you pack** —
ships keep flying and requests keep expiring. That tension is the core of the game and falls out
of the architecture for free (the loop has no concept of "a modal is open").

## Rendering split

- **Canvas** (one full-bleed layer, `z-map`) — the live map: parchment ground, routes, city
  nodes, moving airships, glow. Immediate-mode redraw suits ≤12 moving sprites.
- **DOM/CSS** (`z-panels`, `z-overlay`) — HUD, request boards, ship inspector, and the packing
  overlay. Pointer Events + CSS transforms give accessible, GPU-composited drag/rotate/flip.

**Painterly steampunk with no raster assets:** SVG `feTurbulence` filters in `index.html` `<defs>`
(parchment grain, brushed-brass displacement) referenced from CSS; Canvas gradients for metal and
glow; inline SVG ornaments. Expensive noise is baked to a static layer, not animated per frame.

## Packing engine

Polyominoes are normalized `Cell[]` sets. `rotate90: (x,y)→(y,−x)`; `flip: (x,y)→(−x,y)`; both
re-normalize (translate to origin + sort) so equality/dedup is well-defined. Hold occupancy is a
`Uint8Array(w*h)` **derived on demand** from `placements` (never stored stale). `canPlace` checks
bounds + overlap. Payout = loaded value + `BONUS_MAX·smoothstep(fill, FILL_FLOOR, 1)`, then the NPC
fee for booked ships. Partial loads are allowed; choosing the best-value subset is the puzzle.

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
