import { polylinePosition, routePolyline, routeProgress } from '../core/geometry';
import type { GameState, Vec2 } from '../core/types';
import { COL, paintAirship, paintCity, paintCityMap, paintRoutePath, paintScreenBackground } from './paint';
import { computeTransform, shipAnchor, type Transform } from './viewport';
import type { Pick } from './hitTest';
import { Effects } from './effects';
import cityMapUrl from '../assets/zybourne-city.png';

/**
 * Make the map's flat white surround transparent by flood-filling near-white from the
 * border inward, so the sepia panel shows behind the city instead of a bright rectangle.
 * Edge-contiguous only → interior white (e.g. the printed district-label fills) is preserved.
 * Falls back to the raw image if the canvas read fails.
 */
function knockOutWhiteBackground(img: HTMLImageElement): CanvasImageSource {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return img;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return img; // tainted canvas — shouldn't happen for a same-origin asset
  }
  const px = data.data;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const isWhite = (p: number): boolean => {
    const i = p * 4;
    return px[i]! >= 242 && px[i + 1]! >= 242 && px[i + 2]! >= 242 && px[i + 3]! > 0;
  };
  const consider = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isWhite(p)) stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    consider(x, 0);
    consider(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    consider(0, y);
    consider(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    px[p * 4 + 3] = 0; // transparent
    const x = p % w;
    const y = (p / w) | 0;
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  transform: Transform = { scale: 1, ox: 0, oy: 0 };
  selected: Pick | null = null;
  private effects = new Effects();
  private mapImg: CanvasImageSource | null = null;
  private mapReady = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;
    this.resize();
    // Preload the city-map raster; the rAF loop redraws each frame, so it appears once ready.
    const img = new Image();
    img.onload = () => {
      // Knock out the GIF's flat white surround so the sepia ground shows through the frame.
      this.mapImg = knockOutWhiteBackground(img);
      this.mapReady = true;
    };
    img.src = cityMapUrl;
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

  effectDeliver(p: Vec2, amount: number): void {
    this.effects.deliver(p, amount, performance.now());
  }
  effectExpire(p: Vec2): void {
    this.effects.expire(p, performance.now());
  }
  effectCost(p: Vec2, amount: number): void {
    this.effects.cost(p, amount, performance.now());
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

    paintCityMap(ctx, this.mapReady ? this.mapImg : null);

    // active-request counts (+ urgency) per origin city
    const counts = new Map<string, number>();
    const urgent = new Set<string>();
    for (const r of s.requests) {
      if (r.status === 'active') {
        counts.set(r.originId, (counts.get(r.originId) ?? 0) + 1);
        if (r.expiresAtMs - s.clockMs < 15_000) urgent.add(r.originId);
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);

    // routes (beneath nodes) — the full multi-stop milk-run polyline
    for (const ship of s.ships) {
      const route = ship.route;
      if (!route || (ship.status !== 'flying' && ship.status !== 'repositioning')) continue;
      const pts = routePolyline(route.from, route.stops);
      const prog = routeProgress(route.departedAtMs, route.arriveAtMs, s.clockMs);
      paintRoutePath(ctx, pts, polylinePosition(pts, prog));
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
        urgent: urgent.has(c.id),
        pulse,
      });
    }

    // ships (above)
    for (const ship of s.ships) {
      const a = shipAnchor(s, ship);
      let angle = 0;
      const route = ship.route;
      if (route && (ship.status === 'flying' || ship.status === 'repositioning')) {
        const pts = routePolyline(route.from, route.stops);
        const prog = routeProgress(route.departedAtMs, route.arriveAtMs, s.clockMs);
        const p0 = polylinePosition(pts, Math.max(0, prog - 0.01));
        const p1 = polylinePosition(pts, Math.min(1, prog + 0.01));
        angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      }
      paintAirship(ctx, a, angle, {
        owned: ship.owned,
        selected: sel?.type === 'ship' && sel.id === ship.id,
        loading: ship.status === 'loading',
      });
    }

    // transient feedback (payout float-ups, delivery rings) atop the map
    this.effects.render(ctx, performance.now());
  }
}
