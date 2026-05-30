import { pathPosition, routeProgress } from '../core/geometry';
import type { GameState, Vec2 } from '../core/types';
import { COL, paintAirship, paintCity, paintParchment, paintRoutePath, paintScreenBackground } from './paint';
import { computeTransform, shipAnchor, type Transform } from './viewport';
import type { Pick } from './hitTest';

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  transform: Transform = { scale: 1, ox: 0, oy: 0 };
  selected: Pick | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
  }

  setSelection(sel: Pick | null): void {
    this.selected = sel;
  }

  render(s: GameState): void {
    const ctx = this.ctx;
    const { cssW, cssH, dpr } = this;

    // screen-space ground
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScreenBackground(ctx, cssW, cssH);

    // world-space content (device = dpr · (world · scale + offset))
    const t = computeTransform(cssW, cssH);
    this.transform = t;
    ctx.setTransform(dpr * t.scale, 0, 0, dpr * t.scale, dpr * t.ox, dpr * t.oy);
    ctx.lineCap = 'round';

    paintParchment(ctx);

    // active-request counts per origin city
    const counts = new Map<string, number>();
    for (const r of s.requests) {
      if (r.status === 'active') counts.set(r.originId, (counts.get(r.originId) ?? 0) + 1);
    }

    // routes (beneath nodes)
    for (const ship of s.ships) {
      const route = ship.route;
      if (!route || (ship.status !== 'flying' && ship.status !== 'repositioning')) continue;
      const pts: Vec2[] = route.via ? [route.from, route.via, route.to] : [route.from, route.to];
      const prog = routeProgress(route.departedAtMs, route.arriveAtMs, s.clockMs);
      paintRoutePath(ctx, pts, pathPosition(route.from, route.via, route.to, prog));
    }

    // bookable charters (faint, tethered to the city they hover near)
    for (const o of s.npcOffers) {
      const city = s.cities.find((c) => c.id === o.nearCityId);
      ctx.save();
      ctx.globalAlpha = 0.5;
      if (city) {
        ctx.strokeStyle = COL.verd1;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(o.spawn.x, o.spawn.y);
        ctx.lineTo(city.x, city.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      paintAirship(ctx, o.spawn, 0, { owned: false, selected: false, loading: false });
      ctx.restore();
    }

    // cities
    const hubId = s.cities[0]?.id;
    const sel = this.selected;
    for (const c of s.cities) {
      paintCity(ctx, c, {
        hub: c.id === hubId,
        activeCount: counts.get(c.id) ?? 0,
        selected: sel?.type === 'city' && sel.id === c.id,
      });
    }

    // ships (above)
    for (const ship of s.ships) {
      const a = shipAnchor(s, ship);
      let angle = 0;
      const route = ship.route;
      if (route && (ship.status === 'flying' || ship.status === 'repositioning')) {
        const prog = routeProgress(route.departedAtMs, route.arriveAtMs, s.clockMs);
        const p0 = pathPosition(route.from, route.via, route.to, Math.max(0, prog - 0.01));
        const p1 = pathPosition(route.from, route.via, route.to, Math.min(1, prog + 0.01));
        angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      }
      paintAirship(ctx, a, angle, {
        owned: ship.owned,
        selected: sel?.type === 'ship' && sel.id === ship.id,
        loading: ship.status === 'loading',
      });
    }
  }
}
