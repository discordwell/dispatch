import { config } from '../config';
import type { Vec2 } from '../core/types';

/** Palette (mirrors styles/tokens.css). Canvas wants literals. */
export const COL = {
  sepia0: '#160f08',
  sepia1: '#241a10',
  sepia2: '#34261a',
  parch0: '#c9b48a',
  parch1: '#ddc9a0',
  parch2: '#efe3c6',
  parchInk: '#2b2018',
  brass0: '#6b4e0a',
  brass1: '#9a7414',
  brass2: '#c79a2e',
  brass3: '#e8c87a',
  brassHi: '#f8e7b0',
  verd1: '#3a7d6e',
  verd2: '#5fae9b',
  danger: '#a83232',
  dangerHi: '#e0654f',
  gold: '#e8c87a',
} as const;

const TAU = Math.PI * 2;

/** Screen-space ground behind the map. */
export function paintScreenBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.32, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  g.addColorStop(0, COL.sepia2);
  g.addColorStop(1, COL.sepia0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** World-space parchment sheet with brass frame + corner rivets. */
export function paintParchment(ctx: CanvasRenderingContext2D): void {
  const W = config.MAP_W;
  const H = config.MAP_H;
  const r = 26;

  // drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = COL.parch1;
  roundRect(ctx, 0, 0, W, H, r);
  ctx.fill();
  ctx.restore();

  // parchment fill
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.5, Math.max(W, H) * 0.62);
  g.addColorStop(0, COL.parch2);
  g.addColorStop(0.7, COL.parch1);
  g.addColorStop(1, COL.parch0);
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, r);
  ctx.fill();

  // faint cartographic hairlines
  ctx.save();
  roundRect(ctx, 0, 0, W, H, r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(92,70,49,0.10)';
  ctx.lineWidth = 1;
  for (let x = 100; x < W; x += 100) line(ctx, x, 0, x, H);
  for (let y = 100; y < H; y += 100) line(ctx, 0, y, W, y);
  // edge vignette
  const v = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.36, W * 0.5, H * 0.5, Math.max(W, H) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(60,40,20,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // brass frame
  ctx.lineJoin = 'round';
  const fg = ctx.createLinearGradient(0, 0, 0, H);
  fg.addColorStop(0, COL.brass3);
  fg.addColorStop(0.5, COL.brass1);
  fg.addColorStop(1, COL.brass0);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 10;
  roundRect(ctx, 5, 5, W - 10, H - 10, r - 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,15,8,0.6)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 10, 10, W - 20, H - 20, r - 8);
  ctx.stroke();

  for (const [cx, cy] of [
    [16, 16],
    [W - 16, 16],
    [16, H - 16],
    [W - 16, H - 16],
  ] as const) {
    rivet(ctx, cx, cy, 5);
  }
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r);
  g.addColorStop(0, COL.brassHi);
  g.addColorStop(1, COL.brass0);
  ctx.fillStyle = g;
  disc(ctx, x, y, r);
  ctx.strokeStyle = 'rgba(20,15,8,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export interface CityPaintOpts {
  hub: boolean;
  activeCount: number;
  selected: boolean;
}

export function paintCity(ctx: CanvasRenderingContext2D, c: { name: string; x: number; y: number }, o: CityPaintOpts): void {
  const R = o.hub ? 15 : 10;

  // ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(40,26,16,0.30)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + R * 0.7, R * 1.25, R * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (o.selected) {
    ctx.strokeStyle = COL.verd2;
    ctx.lineWidth = 3;
    ctx.shadowColor = COL.verd2;
    ctx.shadowBlur = 14;
    disc(ctx, c.x, c.y, R + 7);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // brass node
  const g = ctx.createRadialGradient(c.x - R * 0.35, c.y - R * 0.4, 1, c.x, c.y, R);
  g.addColorStop(0, COL.brassHi);
  g.addColorStop(0.55, COL.brass2);
  g.addColorStop(1, COL.brass0);
  ctx.fillStyle = g;
  disc(ctx, c.x, c.y, R);
  ctx.fill();
  ctx.strokeStyle = COL.sepia1;
  ctx.lineWidth = 2;
  ctx.stroke();

  // clock-face center
  ctx.fillStyle = COL.sepia1;
  disc(ctx, c.x, c.y, R * 0.42);
  ctx.fill();
  ctx.strokeStyle = COL.brass3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x, c.y - R * 0.32);
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x + R * 0.24, c.y + R * 0.1);
  ctx.stroke();

  // label plate
  ctx.font = `600 ${o.hub ? 20 : 16}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(c.name).width;
  const ly = c.y + R + 14;
  ctx.fillStyle = 'rgba(40,26,16,0.18)';
  roundRect(ctx, c.x - tw / 2 - 7, ly - 11, tw + 14, 22, 6);
  ctx.fill();
  ctx.fillStyle = COL.parchInk;
  ctx.fillText(c.name, c.x, ly);

  // active-request badge
  if (o.activeCount > 0) {
    const bx = c.x + R + 2;
    const by = c.y - R - 2;
    ctx.fillStyle = COL.danger;
    ctx.shadowColor = 'rgba(168,50,50,0.7)';
    ctx.shadowBlur = 8;
    disc(ctx, bx, by, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COL.brassHi;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 12px ui-monospace, monospace`;
    ctx.fillText(String(o.activeCount), bx, by + 1);
  }
}

export function paintRoutePath(
  ctx: CanvasRenderingContext2D,
  pts: Vec2[],
  marker: Vec2 | null,
): void {
  if (pts.length < 2) return;
  ctx.save();
  // glow
  ctx.strokeStyle = COL.verd1;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 7;
  ctx.shadowColor = COL.verd2;
  ctx.shadowBlur = 12;
  polyline(ctx, pts);
  ctx.stroke();
  // dashed core
  ctx.globalAlpha = 0.9;
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = COL.verd2;
  polyline(ctx, pts);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (marker) {
    ctx.save();
    ctx.fillStyle = COL.brassHi;
    ctx.strokeStyle = COL.sepia1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 3.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export interface ShipPaintOpts {
  owned: boolean;
  selected: boolean;
  loading: boolean;
}

export function paintAirship(ctx: CanvasRenderingContext2D, pos: Vec2, angle: number, o: ShipPaintOpts): void {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  const L = 17;
  const Hh = 7;

  if (o.selected) {
    ctx.strokeStyle = COL.verd2;
    ctx.lineWidth = 2;
    ctx.shadowColor = COL.verd2;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, L + 6, Hh + 7, 0, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // envelope
  const g = ctx.createLinearGradient(0, -Hh, 0, Hh);
  g.addColorStop(0, o.owned ? COL.brassHi : COL.verd2);
  g.addColorStop(0.5, o.owned ? COL.brass2 : COL.verd1);
  g.addColorStop(1, o.owned ? COL.brass0 : '#244c44');
  ctx.fillStyle = g;
  ctx.strokeStyle = COL.sepia1;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // tail fin
  ctx.fillStyle = o.owned ? COL.brass0 : '#244c44';
  ctx.beginPath();
  ctx.moveTo(-L + 1, 0);
  ctx.lineTo(-L - 6, -6);
  ctx.lineTo(-L - 6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // gondola
  ctx.fillStyle = COL.sepia1;
  roundRect(ctx, -5, Hh - 1, 10, 5, 2);
  ctx.fill();

  // loading pulse
  if (o.loading) {
    ctx.fillStyle = COL.gold;
    ctx.globalAlpha = 0.9;
    disc(ctx, L + 6, 0, 2.5);
    ctx.fill();
  }
  ctx.restore();
}

// ── primitives ────────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function polyline(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.beginPath();
  const first = pts[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p) ctx.lineTo(p.x, p.y);
  }
}
