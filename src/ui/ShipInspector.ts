import type { GameState } from '../core/types';
import { formatCountdown, formatMoney } from './format';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  loading: 'Loading cargo',
  flying: 'In flight',
  repositioning: 'Repositioning',
};

export class ShipInspector {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private body: HTMLElement;

  constructor(parent: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
      <div class="panel-head">
        <span class="panel-title"></span>
        <span class="panel-sub">airship</span>
      </div>
      <div class="panel-body"></div>`;
    parent.appendChild(el);
    this.el = el;
    this.title = el.querySelector('.panel-title')!;
    this.sub = el.querySelector('.panel-sub')!;
    this.body = el.querySelector('.panel-body')!;
  }

  hide(): void {
    this.el.classList.remove('show');
  }

  update(s: GameState, shipId: string): void {
    const ship = s.ships.find((x) => x.id === shipId);
    if (!ship) {
      this.hide();
      return;
    }
    this.el.classList.add('show');
    const nameOf = (id: string | null) => (id ? (s.cities.find((c) => c.id === id)?.name ?? id) : '—');

    this.title.textContent = ship.shipClass;
    this.sub.textContent = ship.owned ? 'your airship' : 'booked charter';

    const rows: Array<[string, string]> = [
      ['Status', STATUS_LABEL[ship.status] ?? ship.status],
      ['Hold', `${ship.holdW} × ${ship.holdH}`],
    ];
    if (ship.status === 'flying' && ship.route) {
      const route = ship.route;
      const remaining = route.stops.slice(route.nextStopIndex);
      rows.push(['Stops', remaining.map((st) => nameOf(st.cityId)).join(' → ') || '—']);
      const next = remaining[0];
      if (next) rows.push(['Next ETA', formatCountdown(next.arriveAtMs - s.clockMs)]);
      if (ship.hold) {
        const itemCount = ship.hold.lots.reduce((n, l) => n + l.items.length, 0);
        const remainingPay = ship.hold.lots.reduce((a, l) => a + l.payout, 0);
        rows.push(['Cargo', `${itemCount} item${itemCount === 1 ? '' : 's'}`]);
        rows.push(['Payout remaining', formatMoney(remainingPay)]);
      }
    } else {
      rows.push(['Location', nameOf(ship.loadingDockId ?? ship.locationId)]);
    }
    if (!ship.owned) rows.push(['Booking fee', `${Math.round(ship.feeFraction * 100)}%`]);

    this.body.innerHTML = rows
      .map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`)
      .join('');
  }
}
