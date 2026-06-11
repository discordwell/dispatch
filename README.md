# Dispatch

A zeppelin-dispatcher game set in the cyber-world of the **Zybourne Clock**. You run the airship
desk for one city: orders pile up at the docks, each one a fistful of oddly-shaped polyomino crates.
Reserve a ship, hand-pack its hold (rotate, flip, squeeze the fill bonus out of every cell), then
send it on a multi-stop milk-run that auto-unloads at each destination — while the shift clock keeps
running and unloved orders expire. Clear the earnings threshold before the bell across five
escalating shifts ("aces") to finish the campaign.

**Play it:** https://dispatch.discordwell.com

The core tension: **packing never pauses the clock.** The hold puzzle is a DOM overlay; the
simulation underneath keeps flying ships, spawning orders, and expiring the ones you dawdle on.

## Develop

```sh
npm install
npm run dev        # Vite dev server
npm test           # Vitest (pure core logic, node env — no browser needed)
npm run typecheck  # tsc --noEmit (also covers measure-balance.ts)
npm run build      # typecheck + production bundle to dist/
```

No runtime dependencies — TypeScript + Vite + Vitest only. The UI is hand-rolled DOM/Canvas;
audio is procedural WebAudio; the only binary asset is the city-map raster.

Dev conveniences (see `src/main.ts`): `?speed=N` fast-forwards simulation time, and the
`window.__dispatch` handle (`.tick(ms)`, `.store`) drives the sim from the console even in a
backgrounded tab — used for wet-testing.

## Balance

`measure-balance.ts` plays every level headlessly with the real game code under a careful
multi-load dispatcher policy and prints achievable earnings next to each threshold:

```sh
npx vite-node measure-balance.ts
```

Thresholds are tuned to a fraction of a careful run's take; `tests/levels.test.ts` guards that
every level stays winnable (and that order lifetimes stay long enough for multi-load batching).

## Docs

- `GAME_DESIGN.md` — the design: fiction, mechanics, economy, level arc
- `ARCHITECTURE.md` — layering rules, module map, time model, rendering split
- `claudepad.md` — session-by-session development log

## Deploy

`./scripts/deploy.sh` rsyncs `dist/` to the static host and reloads Caddy (requires SSH access to
the server; see `ARCHITECTURE.md` → Build & deploy).
