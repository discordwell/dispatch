import { describe, it, expect } from 'vitest';
import { shapeGlyphSVG } from '../src/ui/shapeGlyph';
import type { Cell } from '../src/core/types';

const single: Cell[] = [{ x: 0, y: 0 }];
const I4: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
const L: Cell[] = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

const rectCount = (svg: string): number => (svg.match(/<rect/g) ?? []).length;

describe('shapeGlyphSVG', () => {
  it('emits one tile rect per cell', () => {
    expect(rectCount(shapeGlyphSVG(single))).toBe(1);
    expect(rectCount(shapeGlyphSVG(I4))).toBe(4);
    expect(rectCount(shapeGlyphSVG(L))).toBe(3);
  });

  it('sizes the viewport from the bounding box and gap (default cell 8, gap 1)', () => {
    // I4 is 4×1 → W = 4·8 + 5·1 = 37, H = 1·8 + 2·1 = 10.
    const svg = shapeGlyphSVG(I4);
    expect(svg).toContain('width="37"');
    expect(svg).toContain('height="10"');
    expect(svg).toContain('viewBox="0 0 37 10"');
    expect(svg).toContain('class="glyph"');
  });

  it('normalizes the input so an offset piece renders identically', () => {
    const offset = L.map((c) => ({ x: c.x + 9, y: c.y + 4 }));
    expect(shapeGlyphSVG(offset)).toBe(shapeGlyphSVG(L));
  });

  it('honors cell/gap/fill/stroke overrides', () => {
    const svg = shapeGlyphSVG(single, { cell: 7, gap: 2, fill: '#abcdef', stroke: '#123456' });
    // W = 1·7 + 2·2 = 11
    expect(svg).toContain('width="11"');
    expect(svg).toContain('fill="#abcdef"');
    expect(svg).toContain('stroke="#123456"');
  });

  it('positions each tile at gap + index·(cell+gap)', () => {
    // The second cell of I4 sits at x = 1 + 1·(8+1) = 10, y = 1.
    const svg = shapeGlyphSVG(I4);
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="1"');
  });
});
