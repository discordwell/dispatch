import { normalize, boundingBox } from '../core/polyomino';
import type { Cell } from '../core/types';

export interface GlyphOpts {
  cell?: number;
  gap?: number;
  fill?: string;
  stroke?: string;
}

/** Render a polyomino as a small inline SVG of brass tiles. Reused by board + packing tray. */
export function shapeGlyphSVG(cells: readonly Cell[], opts: GlyphOpts = {}): string {
  const cell = opts.cell ?? 8;
  const gap = opts.gap ?? 1;
  const fill = opts.fill ?? '#c79a2e';
  const stroke = opts.stroke ?? '#241a10';
  const n = normalize(cells);
  const { w, h } = boundingBox(n);
  const W = w * cell + (w + 1) * gap;
  const H = h * cell + (h + 1) * gap;
  const tiles = n
    .map((c) => {
      const x = gap + c.x * (cell + gap);
      const y = gap + c.y * (cell + gap);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`;
    })
    .join('');
  return `<svg class="glyph" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${tiles}</svg>`;
}
