# Claudepad — Dispatch

Session memory for the Dispatch game (zeppelin dispatcher in the Zybourne Clock world).
Newest session summaries on top (keep 20; overflow → `oldpad.md`). Key Findings at the bottom are permanent.

---

## Session Summaries

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
