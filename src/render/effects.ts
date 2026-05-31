import type { Vec2 } from '../core/types';
import { COL } from './paint';

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  ttl: number;
}
interface Ring {
  x: number;
  y: number;
  born: number;
  ttl: number;
}

/** Transient world-space feedback (payout float-ups, delivery rings). Rendered atop the map. */
export class Effects {
  private floats: FloatText[] = [];
  private rings: Ring[] = [];

  deliver(p: Vec2, amount: number, now: number): void {
    this.floats.push({
      x: p.x,
      y: p.y - 20,
      text: `+§${Math.round(amount).toLocaleString('en-US')}`,
      color: COL.brassHi,
      born: now,
      ttl: 1500,
    });
    this.rings.push({ x: p.x, y: p.y, born: now, ttl: 720 });
  }

  expire(p: Vec2, now: number): void {
    this.floats.push({ x: p.x, y: p.y - 16, text: 'expired', color: COL.dangerHi, born: now, ttl: 1100 });
  }

  /** A charter's fixed hire fee, floated where the contract hull launches. */
  cost(p: Vec2, amount: number, now: number): void {
    this.floats.push({
      x: p.x,
      y: p.y - 16,
      text: `−§${Math.round(amount).toLocaleString('en-US')}`,
      color: COL.dangerHi,
      born: now,
      ttl: 1500,
    });
  }

  clear(): void {
    this.floats.length = 0;
    this.rings.length = 0;
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    for (const r of this.rings) {
      const t = (now - r.born) / r.ttl;
      if (t >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = COL.brass3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + t * 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 18px ui-monospace, monospace`;
    for (const f of this.floats) {
      const t = (now - f.born) / f.ttl;
      if (t >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      const y = f.y - t * 32;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(20,15,8,0.65)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
      ctx.restore();
    }

    this.floats = this.floats.filter((f) => now - f.born < f.ttl);
    this.rings = this.rings.filter((r) => now - r.born < r.ttl);
  }
}
