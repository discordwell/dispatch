# Claudepad — Dispatch

Session memory for the Dispatch game (zeppelin dispatcher in the Zybourne Clock world).
Newest session summaries on top (keep 20; overflow → `oldpad.md`). Key Findings at the bottom are permanent.

---

## Session Summaries

### 2026-05-31T01:00Z — Text-free regenerated map + station-style dock names
- User had ChatGPT regenerate the city map with the baked-in district labels removed (in the **browser**, via their ChatGPT session — they corrected an initial attempt of mine to use the OpenAI API CLI) and asked to (a) use it as the background and (b) rename docks so each name reflects the **locale it sits in** (station-style, not bare district labels). Build clean, 77 tests green, wet-tested on the dev server (no console errors), redeployed.
- **Asset:** replaced `src/assets/zybourne-city.png` with the text-free render (**1416×1111**, pngquant'd 1.7 MB → 674 KB). Same composition as the old 765×600 → **all 12 dock coords still line up** unchanged. `paintCityMap` draws it scaled into the 765×600 map-unit rect; `knockOutWhiteBackground` still clears the white surround cleanly (verified — no edge halo). Map units stay 765×600 (asset just renders crisper).
- **Dock renames (id + name):** the three bare district-label docks → locale station names: `the-slums`→`tenement-junction` "Tenement Junction", `commercial-quay`→`market-cross` "Market Cross", `uptown-heights`→`highgate-terrace` "Highgate Terrace". Kept the already-evocative clockwork names (Loading Bay, Clocktower Plaza, Cog Junction, Garrison Keep, Sprocket Row, Gearford Wall, Brass Gate, Aether Pier, Tinker's End). Updated all 5 level `cityIds`; `levels.test` (`cityExists`) + `requestGen.test` (`getCity`) validate the renames — no new test needed (existing guards cover it).
- Focused self-review instead of the full subagent (small, fully verified diff): swept for old-name/id stragglers, refreshed the now-stale "765×600 GIF / printed district-label" notes in `ARCHITECTURE.md` + the `knockOutWhiteBackground` comment.

### 2026-05-31T00:17Z — Much slower per-level cruise + Send-to-dock reposition
- User asks: cruise speed ~1/3–1/2 of before, slower for later levels; and let you send your own airships to a dock. 77 tests green, build clean, wet-tested live, redeployed.
- **Speed is now per-level.** Removed global `config.SHIP_SPEED`/`NPC_SPEED`; added `LevelConfig.shipSpeed` (owned cruise: **L1 30 → L5 18**, ramping down — was a flat 48) + `config.CHARTER_SPEED_MULT` 1.15. `buildMilkRun`/`reposition` read `s.config.shipSpeed`; charters × the mult. (A cross-map hop is now ~16s.)
- **Reposition ("Send to dock"):** new `actions.reposition(s, shipId, dockId)` — an idle OWNED ship flies empty (`status:'repositioning'`, `purpose:'reposition'` route, no hold) and idles at the dock via `advanceStops`' no-hold path (no earnings/events; owned so the charter-reaper skips it). The `'repositioning'`/`'reposition'` plumbing was already wired in sim/viewport/MapRenderer. UI: `ShipInspector` gains a "Send to dock…" button (and shows "Heading to / Next ETA" while repositioning) → `GameUI` one-shot mode (`.reposition-banner` + Esc); the next canvas dock-click sends it (keeps it selected), clicking off a dock cancels; `clearRepos()` on every exit path (dock click, off-dock, Esc, shift end, title, level load).
- **Thresholds re-tuned** for the slower ships (careful ceilings dropped to ~6.6k/15k/21k/22k/23.5k): **4000/9000/13000/15000/17000** (~0.6–0.72× careful; margins gently tighten toward L5). `measure-balance.ts`/`levels.test` pick up the per-level speed automatically.
- /code-review: no critical/important; fixed the stale `ShipStatus` comment + added a reaper-exclusion test.

### 2026-05-30T23:59Z — Slower ships, fixed-cost charters, brass labels
- User asks: slow airships a bit; make hiring **contract ships** worthwhile only with a multi-load (choose the size but can't always get the one you want, fixed cost, one trip, larger = pricier); contracts persist much longer. Plus: redesign the janky dock labels. 74 vitest tests green, build clean, wet-tested live, redeployed.
- **Speed:** `SHIP_SPEED 60→48`, `NPC_SPEED 72→56` (config).
- **Charters → fixed cost by hull (no more % fee).** Removed `feeFraction` everywhere (NpcOffer/Airship/NpcConfig, computePayout, the 5 level npc blocks). Added `ShipClass.charterCost` (Scout 350 / Hauler 650 / Leviathan 1000), `Airship.charterCost`, `NpcOffer.cost`. `computePayout` returns gross only; `commitLoad` deducts `ship.charterCost` from earnings ONCE on dispatch (owned = 0; charged only on success, so a failed/abandoned/reaped charter costs nothing). Net = delivered gross − fixed cost → a small load is a loss, a full multi-load profits. Earnings can go negative (intended); HUD bar clamped to [0,100].
- **Sized market that lingers:** `NPC_OFFER_REFRESH_MS 18k→75k`, `NPC_MARKET_DOCKS 3`, `NPC_MAX_SIZES_PER_DOCK 2`. `refreshNpcOffers` offers a random distinct subset of hull sizes per demand dock (seeded `shuffled` Fisher–Yates; deterministic). `npcOffersAt(dockId)` replaced `npcOfferNear`.
- **UI:** RequestBoard action row = "Load Cargo" (brass, owned) + a teal "Hire ⟨size⟩ §cost" per offer (`{onLoadDock,onHire}`); `GameUI.hireCharter(offerId)`; overlay readout shows **Hire −§cost / Net** (red when negative); ship-switch chips tag charters with cost; `effects.cost()` floats the fee on dispatch; ShipInspector shows the fixed cost.
- **Dock labels redesigned:** engraved **brass nameplate** (warm, in-world) replacing the stark dark-plate/white-text — `paint.ts` paintCity.
- **Balance retune** for slower ships (careful ceilings dropped): thresholds **5000/11000/14000/17000/20000** (~0.5–0.78× careful; L5 dispatcher-bound = tightest). `levels.test` multi-load policy cap set widened `[3,4,5,6,8,99]` to match `measure-balance.ts`.
- /code-review: no Critical/Important; applied the two recommended one-liners (nSizes clamp, HUD width floor) + a comment fix.

### 2026-05-30T22:51Z — City-map background + multi-load milk-run
- User asks: use the downloaded **Zybourne City** map as the background with **docks** instead of cities, and **pick up multiple loads per trip**. Plan: `~/.claude/plans/synthetic-swinging-thompson.md`. 75 vitest tests green, build clean, hard wet-tested live, redeployed.
- **Map + docks:** `src/assets/zybourne-city.png` (765×600, GIF→PNG) drawn by `paintCityMap` inside the brass frame; `MapRenderer.knockOutWhiteBackground` flood-fills the GIF's white surround → transparent so the sepia ground shows. config `MAP_W/H=765/600`, `SHIP_SPEED 78→60`. `cities.ts` is now 12 **docks** across the map districts (hub = `loading-bay`); `level1..5` cityIds updated. Internal type stays `City`/`cityId` (deliberate — a "city" now models a dock).
- **Multi-load "running milk-run":** load any orders from the dock a ship sits on into ONE hold → ship flies a multi-stop nearest-neighbour route → **auto-unloads** each order at its destination → idles at the final drop (chain the next load there). A non-crediting **pickup stop** is prepended when the ship isn't at the dock (deadhead-to-collect), so any idle ship can load any dock and charters fly in.
  - types: `Route{stops:RouteStop[], nextStopIndex}` (removed via/to/destId); `CargoLot`+`Hold` (removed CargoManifest); `Airship.hold`/`loadingDockId` (removed cargo/assignedRequestId).
  - geometry: `cumulativeLengths`/`polylinePosition`/`routePolyline` (removed pathLength/pathPosition).
  - actions: `beginLoad`/`commitLoad`/`cancelLoad`, `splitNet` (proportional payout, sums to net), `buildMilkRun`, `bookNpc(dockId)`; `autoAssign` kept as a 1-request shim so the headless balance tests hold.
  - sim: `advanceStops` credits each crossed stop exactly once (one deliver event/stop), idles at the last stop. UI: dock-scoped PackingOverlay (tray grouped+colored by destination, "Drops" readout), one dock-level Load action in RequestBoard, ShipInspector lists stops, MapRenderer draws the multi-stop polyline.
- **/code-review (no Critical) — fixed with tests:** degenerate dest==dock excluded (avoids pickup/delivery collision); `commitLoad` drops stale/taken items + dispatches the remainder (two-ship-same-dock race) instead of rejecting wholesale; GameUI cancels a failed commit so a ship is never stranded `loading`; `SHIP_SPEED>0` guard. Deferred minor: dead `repositioning`/`reposition` plumbing (commented reserved).
- Loading does NOT freeze the board (matches "time never pauses"); the overlay self-heals expired orders.
- **Threshold playtest (follow-up):** built `measure-balance.ts` — plays the REAL game with a multi-load dispatcher policy (one dispatcher, packing-time-gated, best over load-size caps). Multi-load earns far more than the old single-request model, so the old thresholds were way too easy (~40–50% of careful). Retuned to ~0.5–0.8× a careful run's take: **L1 5500 / L2 11000 / L3 15000 / L4 19000 / L5 23000** (careful ceilings ≈ 9.7k / 21k / 23k / 27.5k / 28k; L5 is dispatcher-bound so its careful take plateaus → tightest margin, hardest finale). `levels.test` now uses the multi-load policy; `measure-balance.ts` kept as a balance tool (excluded from tsconfig/build).

### 2026-05-30T23:10Z — Full game build-out (post-slice)
- Goal from user: "continue to build the entire game end to end." Built the complete game on top
  of the deployed slice (57 vitest tests green; build clean; hard wet-tested in browser):
  - **Multi-ship control:** packing overlay has a ship selector (chips) to pick/switch which idle
    owned ship loads a request (cancel+begin+reopen, re-keys the hold). Verified Hauler↔Scout on L2.
  - **Campaign meta:** `TitleScreen` (level-select grid, locked/unlocked, best scores) + `state/
    progress.ts` (localStorage, pure `applyResult` tested) + "Five Aces" campaign-complete result.
    Verified: win L1 → unlock L2, best §5,200 saved, Level Select reflects it.
  - **Juice + audio:** `audio.ts` (procedural WebAudio SFX, mute toggle persisted, resumes on
    click) wired to pickup/place/rotate/flip/dispatch/deliver/win/lose. `render/effects.ts`
    payout float-ups + delivery rings; expiring-request badge pulse. Sim emits `events[]`
    (deliver/expire), drained by GameUI each frame. Verified float-ups render.
  - **Balance:** packing-time-aware estimator (dispatcher packs one ship at a time). New thresholds
    L1 4500 / L2 9000 / L3 12000 / L4 15000 / L5 18000 (rising % of careful-play ceiling; charters
    give headroom). `levels.test` now asserts each level winnable under careful-gated greedy.
  - Still **playtest-tune** thresholds against real human play; charters remain simplified (fly
    anywhere, not fixed-destination).

### 2026-05-30T04:41Z — Kickoff → M4 (core loop playable)
- New project. Wrote `GAME_DESIGN.md` (full design) and researched the Zybourne Clock aesthetic
  (steampunk + time-travel, ~A.D. 2351–2381, dirigibles are canon, Johnny Five Aces → the 1–5
  "aces" difficulty scale).
- Locked decisions via Q&A: **vertical slice** (playable Level 1, levels 2–5 as data) · **TS +
  Vite + Vitest** · **painterly steampunk done procedurally** (SVG feTurbulence, no raster
  assets) · **packing = rotate + flip + fill-% bonus, no auto-pack**.
- Core tension to preserve: **packing does NOT pause the sim clock.**
- Plan approved (`~/.claude/plans/kind-tinkering-swing.md`). Milestones M0–M7 tracked as tasks.
- **DONE M0–M7 — full vertical slice complete** (51 vitest tests green; strict typecheck + build
  clean; wet-tested end-to-end in browser):
  - M0 scaffold; M1 pure core; M2 sim+state+loop+requestGen+setup; M3 Canvas map; M4 HUD +
    request boards + ship inspector; M5 **manual packing overlay** (pick/rotate/flip/place,
    validity tint, live payout, commit→fly→deliver — sim never pauses while packing); M6 NPC
    charter booking + win/lose result screen + level progression; M7 polish (Start/briefing
    overlay, Zybourne flavor lines), threshold tuning, deploy artifacts.
  - **Wet test passed end-to-end:** start screen → begin → city board → manual pack → dispatch →
    deliver → §earnings; charter "Hire Charter −30%" when fleet busy → NPC overlay; win screen →
    Next Shift loads L2; lose screen → Replay. Looks polished + on-theme.
  - **/code-review done:** fixed C1 (charter id collision could destroy a live charter — now
    unique ids `npc-<offer>-<seq>` + rollback by reference), I1 (commitPack dedup guard), I2
    (clamp NPC fee). All three regression-tested.
- **Known/deferred (acceptable for slice):** thresholds (3500/7000/11000/16000/24000) are ~30%
  of perfect-instant-greedy — **need real human-paced playtest tuning**; vestigial
  'repositioning' status (via-deadhead implements the behavior); cancelling a charter despawns it.
- **Wet-test note:** automation tab is rAF-throttled (bg). Use `__dispatch.tick(ms)` (window) to
  drive sim time; `?speed=N` fast-forwards. Real play (focused tab) is 60fps. Start screen holds
  the sim paused until "Begin Shift".
- Dev server: `npm run dev -- --port 5179 --strictPort`. Deploy: `./scripts/deploy.sh`.
- **DNS confirmed:** dispatch.discordwell.com → 15.204.59.61 (live). ssh alias `ovh2` = port 41022,
  user ubuntu. No git remote yet (need to ask user about GitHub).

---

## Key Findings (permanent)

- **Deploy:** static site → `ovh2` (15.204.59.61), SSH port **41022**. rsync built `dist/` to
  `/opt/dispatch/site/`; Caddy block in `/etc/caddy/sites/dispatch.discordwell.com` (root
  Caddyfile already `import`s that dir). TLS auto via Let's Encrypt. **Needs DNS A record
  `dispatch.discordwell.com → 15.204.59.61` before first deploy.**
- **Architecture invariant:** `core/` + `data/` are pure (no DOM/canvas); difficulty is data
  (`LevelConfig`), never branching on level number. Lets levels 2–5 be drop-ins.
- **Sim clock is simulation-time** inside `sim.step` (fixed timestep), so it keeps running while
  the packing overlay (a DOM layer) is open — the intended pressure.
- **Ship classes:** Scout 4×4, Hauler 5×6, Leviathan 6×8.
- **Payout:** loaded value + `BONUS_MAX(0.5)·smoothstep(fill, FILL_FLOOR(0.5), 1)`; NPC ships pay
  a fee fraction off the gross.
