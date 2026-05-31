import { boundingBox, orientedCells } from '../core/polyomino';
import { buildOccupancy, canPlace, fillRatio, idx } from '../core/packing';
import { computePayout, loadedValue } from '../core/payout';
import type { GameState, Placement, PolyominoItem, Rotation } from '../core/types';
import { sfx } from '../audio';
import { formatClock, formatMoney } from './format';

const CELL = 40;
// Pieces are colored by DESTINATION so the player can see, at a glance, which drop each goes to.
const DEST_COLORS = ['#c79a2e', '#3a7d6e', '#a8632e', '#6f7d33', '#9a7414', '#b9813a', '#5fae9b', '#a83232'];

interface Held {
  itemId: string;
  rot: Rotation;
  flipped: boolean;
}

export interface PackingCallbacks {
  onCommit: (shipId: string, placements: Placement[]) => void;
  onCancel: (shipId: string) => void;
  onSwitch: (shipId: string) => void;
}

/**
 * The cargo puzzle, now dock-scoped: the tray holds the items of EVERY active order at the
 * dock, grouped and colored by destination. Pack any subset across orders into one hold;
 * the ship then milk-runs to each destination, auto-unloading as it goes. Click a manifest
 * piece to pick it up; move over the hold; R/F rotate/flip; click to place; click a placed
 * piece to lift it. The sim keeps running underneath — the live clock makes dawdling cost you.
 */
export class PackingOverlay {
  readonly el: HTMLElement;
  private frame: HTMLElement;
  private shipNameEl: HTMLElement;
  private holdEl: HTMLElement;
  private trayTitleEl: HTMLElement;
  private shipSelectEl: HTMLElement;
  private clockEl: HTMLElement;
  private expiringEl: HTMLElement;
  private gridEl: HTMLElement;
  private piecesLayer: HTMLElement;
  private trayEl: HTMLElement;
  private readoutEl: HTMLElement;
  private ghostEl: HTMLElement;
  private commitBtn: HTMLButtonElement;
  private cells: HTMLElement[] = [];

  private open_ = false;
  private dockId = '';
  private shipId = '';
  private owned = true;
  private charterCost = 0;
  private w = 0;
  private h = 0;
  private items: PolyominoItem[] = [];
  private itemMap = new Map<string, PolyominoItem>();
  private destByItem = new Map<string, string>();
  private destColor = new Map<string, string>();
  private nameOf: (id: string) => string = (id) => id;
  private liveSig = '';
  private placed = new Map<string, Placement>();
  private held: Held | null = null;
  private pointer = { x: 0, y: 0 };

  constructor(parent: HTMLElement, private cb: PackingCallbacks) {
    const el = document.createElement('div');
    el.className = 'pack-overlay';
    el.innerHTML = `
      <div class="pack-frame">
        <div class="pack-head">
          <div class="pack-head-left">
            <div><span class="ship"></span><span class="hold"></span></div>
            <div class="ship-select"></div>
          </div>
          <div class="clock-wrap">
            <div class="pack-clock">0:00</div>
            <div class="pack-expiring"></div>
          </div>
        </div>
        <div class="pack-main">
          <div class="pack-grid-wrap">
            <div class="pack-grid"><div class="pieces-layer"></div></div>
            <div class="pack-readout"></div>
          </div>
          <div class="pack-tray"><h3 class="tray-title">Manifest</h3><div class="tray-list"></div></div>
        </div>
        <div class="pack-foot">
          <div class="pack-hint">Click a piece · <kbd>R</kbd> rotate · <kbd>F</kbd> flip · <kbd>Esc</kbd> release</div>
          <div class="pack-actions">
            <button class="btn secondary" data-act="rotate">Rotate</button>
            <button class="btn secondary" data-act="flip">Flip</button>
            <button class="btn secondary" data-act="cancel">Cancel</button>
            <button class="btn" data-act="commit">Load &amp; Dispatch</button>
          </div>
        </div>
      </div>
      <div class="ghost"></div>`;
    parent.appendChild(el);
    this.el = el;
    this.frame = el.querySelector('.pack-frame')!;
    this.shipNameEl = el.querySelector('.ship')!;
    this.holdEl = el.querySelector('.hold')!;
    this.trayTitleEl = el.querySelector('.tray-title')!;
    this.shipSelectEl = el.querySelector('.ship-select')!;
    this.clockEl = el.querySelector('.pack-clock')!;
    this.expiringEl = el.querySelector('.pack-expiring')!;
    this.gridEl = el.querySelector('.pack-grid')!;
    this.piecesLayer = el.querySelector('.pieces-layer')!;
    this.trayEl = el.querySelector('.tray-list')!;
    this.readoutEl = el.querySelector('.pack-readout')!;
    this.ghostEl = el.querySelector('.ghost')!;
    this.commitBtn = el.querySelector('[data-act="commit"]')!;

    this.wire();
  }

  isOpen(): boolean {
    return this.open_;
  }

  open(s: GameState, dockId: string, shipId: string): void {
    const ship = s.ships.find((sh) => sh.id === shipId);
    if (!ship) return;
    this.dockId = dockId;
    this.shipId = shipId;
    this.owned = ship.owned;
    this.charterCost = ship.charterCost;
    this.w = ship.holdW;
    this.h = ship.holdH;
    this.placed = new Map();
    this.held = null;
    this.setItemsFrom(s);

    this.shipNameEl.textContent = ship.shipClass;
    this.holdEl.textContent = `hold ${this.w} × ${this.h}`;
    this.trayTitleEl.textContent = `${this.nameOf(dockId)} · manifest`;
    this.renderShipSelect(s, shipId);
    this.buildGrid();
    this.renderAll();
    this.open_ = true;
    this.el.classList.add('show');
  }

  close(): void {
    this.open_ = false;
    this.held = null;
    this.el.classList.remove('show');
    this.ghostEl.classList.remove('show');
  }

  /** Derive the tray from every active order at the dock, colored by destination. */
  private setItemsFrom(s: GameState): void {
    this.nameOf = (id) => s.cities.find((c) => c.id === id)?.name ?? id;
    const reqs = s.requests.filter((r) => r.originId === this.dockId && r.status === 'active');
    this.items = reqs.flatMap((r) => r.items);
    this.itemMap = new Map(this.items.map((i) => [i.id, i]));
    this.destByItem = new Map(reqs.flatMap((r) => r.items.map((i) => [i.id, r.destId] as const)));
    this.destColor = new Map();
    let di = 0;
    for (const r of reqs) {
      if (!this.destColor.has(r.destId)) this.destColor.set(r.destId, DEST_COLORS[di++ % DEST_COLORS.length]!);
    }
    this.liveSig = this.items.map((i) => i.id).join(',');
  }

  /** Keep the header clock + expiring ticker live, and refresh the tray as dock orders change. */
  syncClock(s: GameState): void {
    if (!this.open_) return;
    const left = s.config.durationMs - s.clockMs;
    this.clockEl.textContent = formatClock(left);
    this.clockEl.classList.toggle('low', left <= 60_000);
    const expiring = s.requests.filter(
      (r) => r.status === 'active' && r.expiresAtMs - s.clockMs < 15_000,
    ).length;
    this.expiringEl.textContent = expiring > 0 ? `${expiring} order${expiring > 1 ? 's' : ''} expiring!` : '';

    // The board never freezes: an order can expire (or a new one arrive) while we pack.
    const sig = s.requests
      .filter((r) => r.originId === this.dockId && r.status === 'active')
      .flatMap((r) => r.items.map((i) => i.id))
      .join(',');
    if (sig !== this.liveSig) {
      this.setItemsFrom(s);
      for (const id of [...this.placed.keys()]) if (!this.itemMap.has(id)) this.placed.delete(id);
      if (this.held && !this.itemMap.has(this.held.itemId)) this.held = null;
      this.renderAll();
    }
  }

  /** Chips to switch which idle owned ship loads at this dock (hidden if only one option). */
  private renderShipSelect(s: GameState, activeId: string): void {
    const eligible = s.ships.filter((sh) => (sh.owned && sh.status === 'idle') || sh.id === activeId);
    if (eligible.length <= 1) {
      this.shipSelectEl.innerHTML = '';
      return;
    }
    this.shipSelectEl.innerHTML = eligible
      .map((sh) => {
        const tag = sh.owned ? `${sh.holdW}×${sh.holdH}` : `${sh.holdW}×${sh.holdH} · §${sh.charterCost}`;
        return `<button class="ship-chip ${sh.id === activeId ? 'active' : ''}" data-ship="${sh.id}">${sh.shipClass} <span>${tag}</span></button>`;
      })
      .join('');
  }

  private colorOf(itemId: string): string {
    return this.destColor.get(this.destByItem.get(itemId) ?? '') ?? DEST_COLORS[0]!;
  }

  // ── setup / rendering ────────────────────────────────────────────────────────
  private buildGrid(): void {
    this.gridEl.style.gridTemplateColumns = `repeat(${this.w}, ${CELL}px)`;
    this.gridEl.style.gridAutoRows = `${CELL}px`;
    this.cells.forEach((c) => c.remove());
    this.cells = [];
    for (let i = 0; i < this.w * this.h; i++) {
      const cell = document.createElement('div');
      cell.className = 'pcell';
      this.gridEl.insertBefore(cell, this.piecesLayer);
      this.cells.push(cell);
    }
  }

  private renderAll(): void {
    this.renderPlaced();
    this.renderTray();
    this.renderReadout();
    this.renderGhost();
    this.tint();
  }

  private renderPlaced(): void {
    this.piecesLayer.innerHTML = '';
    for (const [itemId, p] of this.placed) {
      const item = this.itemMap.get(itemId);
      if (!item) continue;
      const el = pieceEl(item, p.rot, p.flipped, CELL, this.colorOf(itemId));
      el.style.left = `${p.origin.x * CELL}px`;
      el.style.top = `${p.origin.y * CELL}px`;
      this.piecesLayer.appendChild(el);
    }
  }

  private renderTray(): void {
    const placedIds = new Set(this.placed.keys());
    const parts: string[] = [];
    let any = false;
    for (const [dest, color] of this.destColor) {
      const pieces = this.items.filter((it) => this.destByItem.get(it.id) === dest && !placedIds.has(it.id));
      if (pieces.length === 0) continue;
      any = true;
      parts.push(
        `<div class="tray-dest"><span class="tray-dot" style="background:${color}"></span>→ ${this.nameOf(dest)}</div>`,
      );
      for (const item of pieces) {
        const isHeld = this.held?.itemId === item.id;
        parts.push(
          `<div class="tray-piece ${isHeld ? 'held' : ''}" data-item="${item.id}">
            ${pieceSVG(item, color)}
            <span class="t-label">${item.label ?? 'Cargo'}</span>
            <span class="t-val">${formatMoney(item.value)}</span>
          </div>`,
        );
      }
    }
    this.trayEl.innerHTML = any
      ? parts.join('')
      : `<div class="pack-tray-empty">Everything's aboard. Cast off!</div>`;
  }

  private renderReadout(): void {
    const placements = [...this.placed.values()];
    const { occupied } = buildOccupancy(this.w, this.h, placements, this.itemMap);
    const loaded = loadedValue(placements, this.itemMap);
    const fill = fillRatio(this.w, this.h, occupied);
    const pay = computePayout({ loaded, fill });
    const drops = new Set([...this.placed.keys()].map((id) => this.destByItem.get(id))).size;
    let html =
      `<span>Value <b>${formatMoney(loaded)}</b></span>` +
      `<span>Fill <b>${Math.round(fill * 100)}%</b></span>` +
      `<span>Drops <b>${drops}</b></span>` +
      `<span>Payout <b>${formatMoney(pay.gross)}</b></span>`;
    if (!this.owned && this.charterCost > 0) {
      const net = pay.gross - this.charterCost;
      html +=
        `<span class="hire">Hire <b>−${formatMoney(this.charterCost)}</b></span>` +
        `<span class="net ${net < 0 ? 'bad' : ''}">Net <b>${formatMoney(net)}</b></span>`;
    }
    this.readoutEl.innerHTML = html;
    this.commitBtn.disabled = placements.length === 0;
  }

  private renderGhost(): void {
    if (!this.held) {
      this.ghostEl.classList.remove('show');
      return;
    }
    const item = this.itemMap.get(this.held.itemId)!;
    this.ghostEl.innerHTML = '';
    const el = pieceEl(item, this.held.rot, this.held.flipped, CELL, this.colorOf(this.held.itemId));
    el.style.left = '0px';
    el.style.top = '0px';
    this.ghostEl.appendChild(el);
    this.ghostEl.classList.add('show');
    this.positionGhost();
  }

  private positionGhost(): void {
    this.ghostEl.style.transform = `translate(${this.pointer.x}px, ${this.pointer.y}px)`;
  }

  // ── geometry helpers ─────────────────────────────────────────────────────────
  private cellUnderPointer(): { x: number; y: number } | null {
    const r = this.gridEl.getBoundingClientRect();
    const x = Math.floor((this.pointer.x - r.left) / CELL);
    const y = Math.floor((this.pointer.y - r.top) / CELL);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return { x, y };
  }

  private occupancyExcludingHeld(): Uint8Array {
    const placements = [...this.placed.values()];
    return buildOccupancy(this.w, this.h, placements, this.itemMap).occupied;
  }

  private heldValidAt(origin: { x: number; y: number }): boolean {
    if (!this.held) return false;
    const item = this.itemMap.get(this.held.itemId)!;
    const occ = this.occupancyExcludingHeld();
    return canPlace(this.w, this.h, occ, item, { ...this.held, origin });
  }

  private tint(): void {
    for (const c of this.cells) c.classList.remove('ok', 'bad');
    if (!this.held) {
      this.ghostEl.classList.remove('bad');
      return;
    }
    const cell = this.cellUnderPointer();
    if (!cell) {
      this.ghostEl.classList.remove('bad');
      return;
    }
    const item = this.itemMap.get(this.held.itemId)!;
    const valid = this.heldValidAt(cell);
    this.ghostEl.classList.toggle('bad', !valid);
    for (const c of orientedCells(item.cells, this.held.rot, this.held.flipped)) {
      const x = cell.x + c.x;
      const y = cell.y + c.y;
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
        this.cells[idx(this.w, x, y)]?.classList.add(valid ? 'ok' : 'bad');
      }
    }
  }

  // ── interaction ──────────────────────────────────────────────────────────────
  private wire(): void {
    document.addEventListener('pointermove', (e) => {
      if (!this.open_) return;
      this.pointer = { x: e.clientX, y: e.clientY };
      if (this.held) {
        this.positionGhost();
        this.tint();
      }
    });

    this.trayEl.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
      if (!chip || this.held) return;
      this.held = { itemId: chip.dataset.item!, rot: 0, flipped: false };
      sfx.pickup();
      this.renderTray();
      this.renderGhost();
      this.tint();
    });

    this.gridEl.addEventListener('click', () => this.onGridClick());
    this.gridEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.held) this.rotateHeld();
    });

    this.frame.addEventListener('click', (e) => {
      const shipBtn = (e.target as HTMLElement).closest<HTMLElement>('[data-ship]');
      if (shipBtn) {
        this.cb.onSwitch(shipBtn.dataset.ship!);
        return;
      }
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'rotate') this.rotateHeld();
      else if (act === 'flip') this.flipHeld();
      else if (act === 'cancel') this.cb.onCancel(this.shipId);
      else if (act === 'commit') this.commit();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.open_) return;
      const k = e.key.toLowerCase();
      if (k === 'r') this.rotateHeld();
      else if (k === 'f') this.flipHeld();
      else if (e.key === 'Escape') {
        if (this.held) this.releaseHeld();
        else this.cb.onCancel(this.shipId);
      }
    });
  }

  private onGridClick(): void {
    const cell = this.cellUnderPointer();
    if (!cell) return;
    if (this.held) {
      if (this.heldValidAt(cell)) {
        this.placed.set(this.held.itemId, {
          itemId: this.held.itemId,
          rot: this.held.rot,
          flipped: this.held.flipped,
          origin: cell,
        });
        this.held = null;
        sfx.place();
        this.renderAll();
      }
      return;
    }
    const owner = this.ownerAt(cell);
    if (owner) {
      const p = this.placed.get(owner)!;
      this.placed.delete(owner);
      this.held = { itemId: owner, rot: p.rot, flipped: p.flipped };
      sfx.pickup();
      this.renderAll();
    }
  }

  private ownerAt(cell: { x: number; y: number }): string | null {
    for (const [itemId, p] of this.placed) {
      const item = this.itemMap.get(itemId);
      if (!item) continue;
      for (const c of orientedCells(item.cells, p.rot, p.flipped)) {
        if (p.origin.x + c.x === cell.x && p.origin.y + c.y === cell.y) return itemId;
      }
    }
    return null;
  }

  private rotateHeld(): void {
    if (!this.held) return;
    this.held.rot = (((this.held.rot + 1) % 4) as Rotation);
    sfx.rotate();
    this.renderGhost();
    this.tint();
  }
  private flipHeld(): void {
    if (!this.held) return;
    this.held.flipped = !this.held.flipped;
    sfx.flip();
    this.renderGhost();
    this.tint();
  }
  private releaseHeld(): void {
    this.held = null;
    this.renderAll();
  }

  private commit(): void {
    const placements = [...this.placed.values()];
    if (placements.length === 0) return;
    this.cb.onCommit(this.shipId, placements);
  }
}

// ── piece rendering helpers ──────────────────────────────────────────────────────
function pieceEl(item: PolyominoItem, rot: Rotation, flipped: boolean, cellPx: number, color: string): HTMLDivElement {
  const cells = orientedCells(item.cells, rot, flipped);
  const { w, h } = boundingBox(cells);
  const el = document.createElement('div');
  el.className = 'ppiece';
  el.style.width = `${w * cellPx}px`;
  el.style.height = `${h * cellPx}px`;
  for (const c of cells) {
    const cell = document.createElement('div');
    cell.className = 'piece-cell';
    cell.style.left = `${c.x * cellPx}px`;
    cell.style.top = `${c.y * cellPx}px`;
    cell.style.width = `${cellPx}px`;
    cell.style.height = `${cellPx}px`;
    cell.style.background = color;
    el.appendChild(cell);
  }
  return el;
}

function pieceSVG(item: PolyominoItem, color: string): string {
  const cells = orientedCells(item.cells, 0, false);
  const { w, h } = boundingBox(cells);
  const cell = 11;
  const gap = 1;
  const W = w * cell + (w + 1) * gap;
  const H = h * cell + (h + 1) * gap;
  const tiles = cells
    .map(
      (c) =>
        `<rect x="${gap + c.x * (cell + gap)}" y="${gap + c.y * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${color}" stroke="#241a10" stroke-width="0.7"/>`,
    )
    .join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${tiles}</svg>`;
}
