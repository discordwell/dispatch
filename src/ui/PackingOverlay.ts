import { boundingBox, orientedCells } from '../core/polyomino';
import { buildOccupancy, canPlace, fillRatio, idx } from '../core/packing';
import { computePayout, loadedValue } from '../core/payout';
import type { GameState, Placement, PolyominoItem, Rotation } from '../core/types';
import { formatClock, formatMoney } from './format';

const CELL = 40;
const PIECE_COLORS = ['#c79a2e', '#b9813a', '#9a7414', '#3a7d6e', '#a8632e', '#6f7d33'];

interface Held {
  itemId: string;
  rot: Rotation;
  flipped: boolean;
}

export interface PackingCallbacks {
  onCommit: (requestId: string, shipId: string, placements: Placement[]) => void;
  onCancel: (requestId: string, shipId: string) => void;
}

/**
 * The cargo puzzle. Click a manifest piece to pick it up; move over the hold; R/F to
 * rotate/flip; click to place; click a placed piece to lift it again. The sim keeps
 * running underneath — the live clock + "expiring" ticker make dawdling cost you.
 */
export class PackingOverlay {
  readonly el: HTMLElement;
  private frame: HTMLElement;
  private shipNameEl: HTMLElement;
  private holdEl: HTMLElement;
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
  private requestId = '';
  private shipId = '';
  private owned = true;
  private fee = 0;
  private w = 0;
  private h = 0;
  private items: PolyominoItem[] = [];
  private itemMap = new Map<string, PolyominoItem>();
  private placed = new Map<string, Placement>();
  private colorByItem = new Map<string, string>();
  private held: Held | null = null;
  private pointer = { x: 0, y: 0 };

  constructor(parent: HTMLElement, private cb: PackingCallbacks) {
    const el = document.createElement('div');
    el.className = 'pack-overlay';
    el.innerHTML = `
      <div class="pack-frame">
        <div class="pack-head">
          <div><span class="ship"></span><span class="hold"></span></div>
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
          <div class="pack-tray"><h3>Manifest</h3><div class="tray-list"></div></div>
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

  open(s: GameState, requestId: string, shipId: string): void {
    const req = s.requests.find((r) => r.id === requestId);
    const ship = s.ships.find((sh) => sh.id === shipId);
    if (!req || !ship) return;
    this.requestId = requestId;
    this.shipId = shipId;
    this.owned = ship.owned;
    this.fee = ship.feeFraction;
    this.w = ship.holdW;
    this.h = ship.holdH;
    this.items = req.items;
    this.itemMap = new Map(req.items.map((i) => [i.id, i]));
    this.placed = new Map();
    this.colorByItem = new Map();
    this.held = null;

    this.shipNameEl.textContent = ship.shipClass;
    this.holdEl.textContent = `hold ${this.w} × ${this.h}`;
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

  /** Keep the header clock + expiring ticker live while packing (sim never pauses). */
  syncClock(s: GameState): void {
    if (!this.open_) return;
    const left = s.config.durationMs - s.clockMs;
    this.clockEl.textContent = formatClock(left);
    this.clockEl.classList.toggle('low', left <= 60_000);
    const expiring = s.requests.filter(
      (r) => r.status === 'active' && r.expiresAtMs - s.clockMs < 15_000,
    ).length;
    this.expiringEl.textContent = expiring > 0 ? `${expiring} request${expiring > 1 ? 's' : ''} expiring!` : '';
  }

  // ── setup / rendering ────────────────────────────────────────────────────────
  private buildGrid(): void {
    this.gridEl.style.gridTemplateColumns = `repeat(${this.w}, ${CELL}px)`;
    this.gridEl.style.gridAutoRows = `${CELL}px`;
    // remove old cells (keep the pieces-layer child)
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
      const color = this.colorByItem.get(itemId) ?? PIECE_COLORS[0]!;
      const el = pieceEl(item, p.rot, p.flipped, CELL, color);
      el.style.left = `${p.origin.x * CELL}px`;
      el.style.top = `${p.origin.y * CELL}px`;
      this.piecesLayer.appendChild(el);
    }
  }

  private renderTray(): void {
    const parts: string[] = [];
    let any = false;
    for (const item of this.items) {
      if (this.placed.has(item.id)) continue;
      any = true;
      const isHeld = this.held?.itemId === item.id;
      const color = PIECE_COLORS[this.colorIndexFor(item.id)]!;
      parts.push(
        `<div class="tray-piece ${isHeld ? 'held' : ''}" data-item="${item.id}">
          ${pieceSVG(item, color)}
          <span class="t-label">${item.label ?? 'Cargo'}</span>
          <span class="t-val">${formatMoney(item.value)}</span>
        </div>`,
      );
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
    const pay = computePayout({ loaded, fill, owned: this.owned, feeFraction: this.fee });
    this.readoutEl.innerHTML =
      `<span>Value <b>${formatMoney(loaded)}</b></span>` +
      `<span>Fill <b>${Math.round(fill * 100)}%</b></span>` +
      `<span>Payout <b>${formatMoney(pay.net)}</b></span>`;
    this.commitBtn.disabled = placements.length === 0;
  }

  private renderGhost(): void {
    if (!this.held) {
      this.ghostEl.classList.remove('show');
      return;
    }
    const item = this.itemMap.get(this.held.itemId)!;
    const color = PIECE_COLORS[this.colorIndexFor(this.held.itemId)]!;
    this.ghostEl.innerHTML = '';
    const el = pieceEl(item, this.held.rot, this.held.flipped, CELL, color);
    el.style.left = '0px';
    el.style.top = '0px';
    this.ghostEl.appendChild(el);
    this.ghostEl.classList.add('show');
    this.positionGhost();
  }

  private positionGhost(): void {
    // top-left of the piece tracks the cursor
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

  private colorIndexFor(itemId: string): number {
    const i = this.items.findIndex((it) => it.id === itemId);
    return ((i < 0 ? 0 : i) % PIECE_COLORS.length + PIECE_COLORS.length) % PIECE_COLORS.length;
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

    // pick up a tray piece
    this.trayEl.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
      if (!chip || this.held) return;
      this.held = { itemId: chip.dataset.item!, rot: 0, flipped: false };
      this.renderTray();
      this.renderGhost();
      this.tint();
    });

    // place / pick-up on the grid (coordinate-based, not element-based)
    this.gridEl.addEventListener('click', () => this.onGridClick());
    this.gridEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.held) this.rotateHeld();
    });

    this.frame.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'rotate') this.rotateHeld();
      else if (act === 'flip') this.flipHeld();
      else if (act === 'cancel') this.cb.onCancel(this.requestId, this.shipId);
      else if (act === 'commit') this.commit();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.open_) return;
      const k = e.key.toLowerCase();
      if (k === 'r') this.rotateHeld();
      else if (k === 'f') this.flipHeld();
      else if (e.key === 'Escape') {
        if (this.held) this.releaseHeld();
        else this.cb.onCancel(this.requestId, this.shipId);
      }
    });
  }

  private onGridClick(): void {
    const cell = this.cellUnderPointer();
    if (!cell) return;
    if (this.held) {
      if (this.heldValidAt(cell)) {
        if (!this.colorByItem.has(this.held.itemId)) {
          this.colorByItem.set(this.held.itemId, PIECE_COLORS[this.colorIndexFor(this.held.itemId)]!);
        }
        this.placed.set(this.held.itemId, { itemId: this.held.itemId, rot: this.held.rot, flipped: this.held.flipped, origin: cell });
        this.held = null;
        this.renderAll();
      }
      return;
    }
    // not holding → pick up a placed piece if the clicked cell belongs to one
    const owner = this.ownerAt(cell);
    if (owner) {
      const p = this.placed.get(owner)!;
      this.placed.delete(owner);
      this.held = { itemId: owner, rot: p.rot, flipped: p.flipped };
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
    this.renderGhost();
    this.tint();
  }
  private flipHeld(): void {
    if (!this.held) return;
    this.held.flipped = !this.held.flipped;
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
    this.cb.onCommit(this.requestId, this.shipId, placements);
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
  // small static glyph for the tray (delegates to shapeGlyph styling but inline here for color)
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
