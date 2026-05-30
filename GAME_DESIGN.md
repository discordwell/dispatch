# Dispatch — Game Design Document

**Working title:** *Dispatch*
**Tagline:** A zeppelin dispatcher in the cyber-world of the Zybourne Clock.
**Host:** dispatch.discordwell.com
**Status:** v1 built & deployed — full 5-level campaign (title/level-select, persistence,
multi-ship, packing puzzle, NPC charters, audio/juice). Remaining work is playtest balance (§9).
**Last updated:** 2026-05-30

---

## 1. Pitch

It is the future. You are a **zeppelin dispatcher** working the airways of the Zybourne
Clock's cyber-world. From a glowing dispatch console you watch a map of 8–12 cities and the
airships threading between them. Citizens post **delivery requests**; you route airships to
pick them up, **hand-pack their oddly-shaped cargo** into the hold for maximum payout, and
race the clock. Five levels, ranked **one ace to five aces** (after Johnny Five Aces himself).
Each level is a **10-minute shift**; clear the earnings threshold to advance.

The game lives in the tension between two demands on your attention:

> **Packing** the hold tightly (more items, weirder shapes = bigger payout) competes with the
> **dispatching** itself (idle airships earn nothing, and lucrative requests expire while you
> fiddle with a cargo grid).

---

## 2. The Zybourne Clock — World & Tone

The Zybourne Clock is a legendary abandoned Something Awful forum game (2003–2006): an
earnest, gloriously overwrought steampunk time-travel epic. We borrow its world and its tone.

**Setting:** Steampunk + time-travel future, circa **A.D. 2351–2381**. Dirigibles, brass
clockwork, magnabikes, nano-enhanced hearing. A "cyber-world" overlay: the dispatcher sees the
airway network through a glowing CRT/radar console.

**Canon characters (flavor):**
- **Johnny Five Aces** — protagonist; beer-drinking, cigar-chomping card player with "giant,
  useless hair" and "a powerful brain compressed for conservation of space." Punches through
  enemies; "rides dirigibles humanely." Our difficulty tiers (1–5 aces) are named for him.
- **Sylus** — combat type, brass knuckles that fire blue energy.
- **Alex, Scholtz, Dirk McLauren** — supporting cast. **Nina** — a lost romance.

**Iconic lines (use verbatim as flavor text / loading screens):**
- "A SHAMEFUL PATH LED THEM TO SEEK IT… FOR THIS IS NO ORDINARY DEVICE… THIS, MY DARLING, IS THE ZYBOURNE CLOCK."
- "Johnny, no — we can't stop, we can't leave, not until we get that clock!"
- "Imagine four balls on the edge of a cliff… the fourth falls off the cliff. **Time works the same way.**"
- "You always had a pension for the dramatic." *(sic — the misspelling is part of the charm)*

**Tone rule:** deliriously earnest and overwrought in *copy and flavor text*; the UI itself is
polished and readable. The "bad-internet-art" charm lives in the writing, not the usability.

---

## 3. Core Loop

1. **Scan** the world map: cities, current/upcoming requests, your airships, bookable NPC ships.
2. **Choose** a request and an airship to fulfill it (your fleet, or book an NPC ship).
3. **Pack** the request's items into that airship's cargo hold (the core puzzle).
4. **Dispatch** — the airship flies origin → destination in real time.
5. **Deliver** — on arrival, payout lands; the ship is free for the next job.
6. **Repeat** under a live 10-minute clock. End over the earnings threshold → advance.

The skill ceiling is **parallelism under time pressure**: keeping 1→5 airships busy, choosing
high-value requests, and packing fast without leaving ships idle or letting requests expire.

---

## 4. Mechanics

### 4.1 World Map
- 8–12 named cities (Zybourne-flavored names) positioned on a stylized map.
- Airships move along straight routes at a fixed speed; travel time ∝ distance.
- Click a city → inspect its **request board** (current + a peek at what's coming soon).
- Click an airship → see its status, cargo, destination, ETA.

### 4.2 Delivery Requests
- A request = **origin city → destination city** + a **set of items** + **reward** + **expiry**.
- Items are **polyominoes** (oddly-shaped, Tetris-like but more varied). More items / weirder
  shapes / larger sets = **higher payout** and lower $-per-cell (you pay in packing effort).
- Requests **expire** if not picked up in time; a board shows current + "incoming in N:NN."
- Higher levels: more requests, faster expiry, nastier shapes, longer routes.

### 4.3 Your Fleet & Booking NPC Airships
- **Owned fleet:** grows from **1 airship (level 1) → 5 airships (level 5).** Different hold
  sizes (see §4.4). Always available; you dispatch and pack them yourself.
- **Booked NPC airships:** for-hire, **single delivery**, **fixed destination**, spawn
  *near-but-not-adjacent* to a city (must fly in first). Costs a booking fee deducted from
  payout. Lets you take on more than your fleet alone can carry — at a margin cost.

### 4.4 Cargo Packing — the Core Puzzle
- A hold is a **2D grid**. Hold sizes vary by airship, e.g.:
  - Scout (small) ≈ 4×4 · Hauler (medium) ≈ 5×6 · Leviathan (large) ≈ 6×8 *(numbers to tune)*
- The request's **items are polyominoes**; the player **drags** each into the grid and
  **rotates** it (90° steps) to fit. No overlaps; pieces must sit fully inside the grid.
- **Partial loads allowed:** you needn't fit every item. You choose the subset that maximizes
  value for that hold — a knapsack-meets-Tetris decision.
- **Payout** = sum of loaded items' values, plus a **packing-efficiency bonus** for high fill %
  (rewards tight packing) — to tune.
- **The tension:** packing happens on the **live clock.** Time spent perfecting a pack is time
  airships sit idle and rival requests expire.

### 4.5 Money & Scoring
- Each delivered item pays its value; booking fees and (maybe) fuel are costs.
- Bonuses: packing efficiency, request complexity, possibly speed/combo streaks.
- Level goal: **total earnings ≥ threshold** before the 10-minute timer ends.

### 4.6 Timer & Level Structure
- Each level = **10 minutes** real-time.
- **One ace → five aces**, rising difficulty: more cities, more/faster requests, more owned
  airships to juggle, harder shapes, higher thresholds.

---

## 5. Levels (one ace → five aces)

| Level | Rank | Fleet | Cities | Vibe |
|------:|:----:|:-----:|:------:|------|
| 1 | ♠ | 1 ship | ~8 | Tutorialish. Learn map, requests, packing. Generous threshold. |
| 2 | ♠♠ | 2 ships | ~9 | Juggle two ships; NPC booking introduced. |
| 3 | ♠♠♠ | 3 ships | ~10 | Faster expiries, harder shapes. |
| 4 | ♠♠♠♠ | 4 ships | ~11 | Dense board; efficiency bonuses matter. |
| 5 | ♠♠♠♠♠ | 5 ships | ~12 | Full chaos. Johnny Five Aces tier. |

*(Counts/thresholds are starting proposals to tune in playtesting.)*

---

## 6. Aesthetic / Art Direction

Direction to be confirmed in planning (§9), but the leading concept:

- **The Dispatch Console:** the player looks at the world through a glowing CRT/radar scope —
  neon vector blips for airships on dark "glass," brass-framed UI panels, subtle scanlines and
  phosphor glow. Steampunk hardware meets cyber display.
- **Palette:** dark teal/black glass; phosphor amber & cyan; brass/copper accents; warning red.
- **Type:** a clean techno-mono for data; an overwrought display face for Zybourne flavor lines.
- **Honor the charm in tone, not jank:** earnest, melodramatic copy; polished, legible UI.

---

## 7. Tech & Hosting (proposed)

- **Client-side static web game** — no backend required for core play.
- Deploy as **static files** served by Caddy on `ovh2`, with a `dispatch.discordwell.com`
  route (same pattern as dwellhome). Optional later: a tiny backend for leaderboards.
- Exact framework decided in planning (§9): leading option is **vanilla TypeScript + HTML5
  Canvas** (map/airship rendering + drag-drop cargo grid) with a light/no build step for a
  clean static deploy.

---

## 8. Out of Scope (for now)

- Multiplayer, accounts, persistent profiles.
- Mobile/touch optimization (desktop-first).
- Audio/music (nice-to-have, later).
- Server-side leaderboards (possible later add).

---

## 9. Resolved decisions & remaining tuning

**Resolved & built:** TS + Vite static deploy · painterly steampunk (procedural, no raster
assets) · rotate **and** flip packing with a fill-% efficiency bonus, no auto-pack · all 5 ace
tiers as data · multi-ship control · NPC charters · campaign progression + localStorage · audio.

**Remaining (playtest tuning):**
- **Thresholds** (L1 4500 / L2 9000 / L3 12000 / L4 15000 / L5 18000) were set from a
  packing-time-aware estimator (≈ a rising % of the careful-play ceiling; charters add headroom).
  Validate against real human-paced play; adjust spawn cadence / value-per-cell if a tier is off.
- **NPC charters** are simplified: a booked charter flies wherever the request goes (the original
  "fixed destination" framing was dropped for fun/clarity). Revisit if matching is desired.
- Possible future: a tutorial hint on L1, more cargo/shape variety, leaderboards.
