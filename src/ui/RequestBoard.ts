import { config } from '../config';
import { idleShips, npcOffersAt } from '../state/actions';
import type { City, DeliveryRequest, GameState, NpcOffer } from '../core/types';
import { formatCountdown, formatMoney } from './format';
import { shapeGlyphSVG } from './shapeGlyph';

export interface BoardCallbacks {
  onLoadDock: (cityId: string) => void;
  onHire: (offerId: string) => void;
}

/**
 * The dock board: orders waiting here now ("Available") + soon-to-arrive ("Incoming"), and an
 * action row — "Load Cargo" with an idle owned ship (free), plus a "Hire ⟨size⟩ §cost" button
 * for each contract hull on offer here (fixed fee, one trip). You pick from the sizes available.
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

  constructor(parent: HTMLElement, cb: BoardCallbacks) {
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
      const t = e.target as HTMLElement;
      const hire = t.closest<HTMLElement>('[data-hire]');
      if (hire) {
        cb.onHire(hire.dataset.hire!);
        return;
      }
      const load = t.closest<HTMLElement>('[data-load]');
      if (load && !(load as HTMLButtonElement).disabled) cb.onLoadDock(this.cityId);
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
    const hasOwnedIdle = idleShips(s).some((sh) => sh.owned);
    const offers = npcOffersAt(s, cityId)
      .slice()
      .sort((a, b) => a.cost - b.cost);

    const sig = [
      cityId,
      active.map((r) => r.id).join(','),
      upcoming.map((r) => r.id).join(','),
      hasOwnedIdle ? 'own' : '-',
      offers.map((o) => o.id).join(','),
    ].join('|');
    if (sig !== this.lastSig || this.cityName !== city.name) {
      this.rebuild(city, active, upcoming, hasOwnedIdle, offers);
      this.lastSig = sig;
      this.cityName = city.name;
    }
    this.updateTimers(s);
  }

  private rebuild(
    city: City,
    active: DeliveryRequest[],
    upcoming: DeliveryRequest[],
    hasOwnedIdle: boolean,
    offers: NpcOffer[],
  ): void {
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

    // action row — only meaningful when there are orders to load here
    const buttons: string[] = [];
    if (active.length) {
      if (hasOwnedIdle) buttons.push(`<button class="btn" data-load>Load Cargo</button>`);
      for (const o of offers) {
        buttons.push(
          `<button class="btn charter" data-hire="${o.id}" title="Contract hull — one trip, fixed fee">Hire ${o.shipClass} ${o.holdW}×${o.holdH} · ${formatMoney(o.cost)}</button>`,
        );
      }
      if (buttons.length === 0) buttons.push(`<button class="btn" disabled title="No airship available">No airship</button>`);
    }
    this.foot.innerHTML = buttons.join('');
    this.foot.style.display = buttons.length ? '' : 'none';
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
