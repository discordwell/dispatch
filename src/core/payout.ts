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
  gross: number; // loaded value + efficiency bonus; paid out in full on delivery
}

/**
 * The delivery payout: loaded value + efficiency bonus. There is no percentage fee — a
 * chartered hull instead costs a fixed fee (charged once on dispatch, see actions.commitLoad).
 */
export function computePayout(opts: { loaded: number; fill: number }): PayoutResult {
  const bonus = efficiencyBonus(opts.loaded, opts.fill);
  const gross = opts.loaded + bonus;
  return { loaded: opts.loaded, fill: opts.fill, bonus, gross };
}
