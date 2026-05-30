import { config } from '../config';
import type { Placement, PolyominoItem } from './types';

/** Hermite smoothstep, clamped to [0,1]. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function loadedValue(
  placements: readonly Placement[],
  items: ReadonlyMap<string, PolyominoItem>,
): number {
  let v = 0;
  for (const p of placements) {
    const item = items.get(p.itemId);
    if (item) v += item.value;
  }
  return v;
}

/** Bonus that rewards tight packing: 0 below FILL_FLOOR, ramping to BONUS_MAX·loaded at full. */
export function efficiencyBonus(loaded: number, fill: number): number {
  return Math.round(loaded * config.BONUS_MAX * smoothstep(config.FILL_FLOOR, 1, fill));
}

export interface PayoutResult {
  loaded: number;
  fill: number;
  bonus: number;
  gross: number;
  net: number;
}

export function computePayout(opts: {
  loaded: number;
  fill: number;
  owned: boolean;
  feeFraction?: number;
}): PayoutResult {
  const bonus = efficiencyBonus(opts.loaded, opts.fill);
  const gross = opts.loaded + bonus;
  const fee = opts.owned ? 0 : Math.min(0.95, Math.max(0, opts.feeFraction ?? 0));
  const net = Math.round(gross * (1 - fee));
  return { loaded: opts.loaded, fill: opts.fill, bonus, gross, net };
}
