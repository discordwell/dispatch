import { config } from '../config';
import { idleShips, npcOfferNear } from '../state/actions';
import type { City, DeliveryRequest, GameState } from '../core/types';
import { formatCountdown, formatMoney } from './format';
import { shapeGlyphSVG } from './shapeGlyph';

type Avail = { kind: 'owned' | 'charter' | 'none'; feePct: number };

/**
 * The dock board: the orders waiting here now ("Available") + soon-to-arrive ("Incoming").
 * One dock-level action loads a ship with any subset of the available orders (the milk-run).
 */
export class RequestBoard {
  readonly el: HTMLElement;
  private headTitle: HTMLElement;
  private body: HTMLElement;
  private foot: HTMLElement;
  private lastSig = '';
  private cityName = '';
  private cityId = '';
  private nameOf: (id: string) => string = (id) => id;

  constructor(parent: HTMLElement, onLoadDock: (cityId: string) => void) {
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
      <div class="panel-head">
        <span class="panel-title"></span>
        <span class="panel-sub">dock board</span>
      </div>
      <div class="panel-body"></div>
      <div class="panel-foot"></div>`;
    parent.appendChild(el);
    this.el = el;
    this.headTitle = el.querySelector('.panel-title')!;
    this.body = el.querySelector('.panel-body')!;
    this.foot = el.querySelector('.panel-foot')!;

    this.foot.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-load-dock]');
      if (btn && !(btn as HTMLButtonElement).disabled) onLoadDock(this.cityId);
    });
  }

  hide(): void {
    this.el.classList.remove('show');
    this.lastSig = '';
  }

  update(s: GameState, cityId: string): void {
    const city = s.cities.find((c) => c.id === cityId);
    if (!city) {
      this.hide();
      return;
    }
    this.el.classList.add('show');
    this.cityId = cityId;
    this.nameOf = (id) => s.cities.find((c) => c.id === id)?.name ?? id;

    const active = s.requests.filter((r) => r.status === 'active' && r.originId === cityId);
    const upcoming = s.requests
      .filter((r) => r.status === 'scheduled' && r.originId === cityId && r.spawnAtMs > s.clockMs)
      .sort((a, b) => a.spawnAtMs - b.spawnAtMs)
      .slice(0, config.UPCOMING_PEEK);
    const charter = npcOfferNear(s, cityId);
    const avail: Avail = idleShips(s).some((sh) => sh.owned)
      ? { kind: 'owned', feePct: 0 }
      : charter
        ? { kind: 'charter', feePct: Math.round(charter.feeFraction * 100) }
        : { kind: 'none', feePct: 0 };

    const sig = [
      cityId,
      active.map((r) => r.id).join(','),
      upcoming.map((r) => r.id).join(','),
      avail.kind,
      avail.feePct,
    ].join('|');
    if (sig !== this.lastSig || this.cityName !== city.name) {
      this.rebuild(city, active, upcoming, avail);
      this.lastSig = sig;
      this.cityName = city.name;
    }
    this.updateTimers(s);
  }

  private rebuild(city: City, active: DeliveryRequest[], upcoming: DeliveryRequest[], avail: Avail): void {
    this.headTitle.textContent = city.name;
    const parts: string[] = [];
    if (active.length === 0 && upcoming.length === 0) {
      parts.push(`<div class="panel-empty">No orders posted here.<br>The skies are quiet.</div>`);
    }
    if (active.length) {
      parts.push(`<div class="section-label">Available now</div>`);
      for (const r of active) parts.push(this.card(r, true));
    }
    if (upcoming.length) {
      parts.push(`<div class="section-label">Incoming</div>`);
      for (const r of upcoming) parts.push(this.card(r, false));
    }
    this.body.innerHTML = parts.join('');

    // one dock-level action: load a ship with any subset of the available orders
    let action = '';
    if (active.length) {
      if (avail.kind === 'owned') {
        action = `<button class="btn" data-load-dock="${city.id}">Load Cargo</button>`;
      } else if (avail.kind === 'charter') {
        action = `<button class="btn" data-load-dock="${city.id}" title="Hire a charter (fee on payout)">Hire Charter −${avail.feePct}%</button>`;
      } else {
        action = `<button class="btn" disabled title="No airship available">No airship</button>`;
      }
    }
    this.foot.innerHTML = action;
    this.foot.style.display = action ? '' : 'none';
  }

  private card(r: DeliveryRequest, isActive: boolean): string {
    const dest = this.nameOf(r.destId);
    const glyphs = r.items
      .map((it) => `<span title="${it.label ?? 'cargo'} · ${formatMoney(it.value)}">${shapeGlyphSVG(it.cells, { cell: 7 })}</span>`)
      .join('');
    const timer = isActive
      ? `<span class="req-timer" data-exp="${r.expiresAtMs}">expires …</span>`
      : `<span class="req-timer" data-spawn="${r.spawnAtMs}">incoming …</span>`;
    return `
      <div class="req ${isActive ? '' : 'upcoming'}" data-req="${r.id}">
        <div class="req-top">
          <span class="req-dest"><span class="arrow">▸</span>${dest}</span>
          <span class="req-reward">${formatMoney(r.baseReward)}</span>
        </div>
        <div class="req-glyphs">${glyphs}</div>
        <div class="req-meta">${timer}</div>
      </div>`;
  }

  private updateTimers(s: GameState): void {
    this.body.querySelectorAll<HTMLElement>('[data-exp]').forEach((el) => {
      const left = Number(el.dataset.exp) - s.clockMs;
      el.textContent = `expires ${formatCountdown(left)}`;
      el.classList.toggle('urgent', left <= 15_000);
    });
    this.body.querySelectorAll<HTMLElement>('[data-spawn]').forEach((el) => {
      el.textContent = `incoming ${formatCountdown(Number(el.dataset.spawn) - s.clockMs)}`;
    });
  }
}
