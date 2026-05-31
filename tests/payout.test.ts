import { describe, it, expect } from 'vitest';
import { smoothstep, loadedValue, efficiencyBonus, computePayout } from '../src/core/payout';
import { config } from '../src/config';
import type { PolyominoItem, Placement } from '../src/core/types';

describe('payout', () => {
  it('smoothstep clamps and is monotonic', () => {
    expect(smoothstep(0.5, 1, 0.5)).toBe(0);
    expect(smoothstep(0.5, 1, 1)).toBe(1);
    expect(smoothstep(0.5, 1, 0.25)).toBe(0); // below floor
    expect(smoothstep(0.5, 1, 2)).toBe(1); // above ceiling
    expect(smoothstep(0.5, 1, 0.7)).toBeLessThan(smoothstep(0.5, 1, 0.85));
    expect(smoothstep(3, 3, 3)).toBe(1); // degenerate edges
  });

  it('loadedValue sums values of placed items only', () => {
    const items = new Map<string, PolyominoItem>([
      ['a', { id: 'a', value: 120, cells: [] }],
      ['b', { id: 'b', value: 80, cells: [] }],
      ['c', { id: 'c', value: 50, cells: [] }],
    ]);
    const placements: Placement[] = [
      { itemId: 'a', rot: 0, flipped: false, origin: { x: 0, y: 0 } },
      { itemId: 'b', rot: 0, flipped: false, origin: { x: 1, y: 0 } },
    ];
    expect(loadedValue(placements, items)).toBe(200);
  });

  it('efficiencyBonus is zero at/below the fill floor and caps at BONUS_MAX when full', () => {
    expect(efficiencyBonus(200, config.FILL_FLOOR)).toBe(0);
    expect(efficiencyBonus(200, 0.2)).toBe(0);
    expect(efficiencyBonus(200, 1)).toBe(Math.round(200 * config.BONUS_MAX));
    // monotonic between floor and full
    expect(efficiencyBonus(200, 0.7)).toBeLessThan(efficiencyBonus(200, 0.9));
  });

  it('computePayout: gross is loaded value plus the efficiency bonus', () => {
    const r = computePayout({ loaded: 200, fill: 1 });
    expect(r.bonus).toBe(100);
    expect(r.gross).toBe(300);
  });

  it('computePayout: a sparse hold earns no bonus', () => {
    const r = computePayout({ loaded: 150, fill: config.FILL_FLOOR });
    expect(r.bonus).toBe(0);
    expect(r.gross).toBe(150);
  });
});
