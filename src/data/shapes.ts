import type { Cell } from '../core/types';

export interface ShapeDef {
  id: string;
  label: string;
  tier: number; // 1 (easy) → 4 (gnarly)
  cells: Cell[]; // base orientation (will be normalized on use)
}

const C = (x: number, y: number): Cell => ({ x, y });

/**
 * Polyomino library, tiered by difficulty. Labels are Zybourne-flavored cargo.
 * Higher tiers = larger / more awkward pieces = higher payout (value scales with
 * cell count), but harder to pack tightly.
 */
export const SHAPES: readonly ShapeDef[] = [
  // ── Tier 1: dominoes & trominoes — gentle ──
  { id: 'cog', label: 'Cog', tier: 1, cells: [C(0, 0), C(1, 0)] },
  { id: 'flux-rod', label: 'Flux Rod', tier: 1, cells: [C(0, 0), C(1, 0), C(2, 0)] },
  { id: 'elbow-joint', label: 'Elbow Joint', tier: 1, cells: [C(0, 0), C(0, 1), C(1, 1)] },

  // ── Tier 2: tetrominoes ──
  { id: 'brass-plate', label: 'Brass Plate', tier: 2, cells: [C(0, 0), C(1, 0), C(0, 1), C(1, 1)] },
  { id: 'piston', label: 'Piston', tier: 2, cells: [C(0, 0), C(1, 0), C(2, 0), C(3, 0)] },
  { id: 'gear-train', label: 'Gear Train', tier: 2, cells: [C(0, 0), C(1, 0), C(2, 0), C(1, 1)] },
  { id: 'crank', label: 'Crank', tier: 2, cells: [C(0, 0), C(0, 1), C(0, 2), C(1, 2)] },
  { id: 'cam', label: 'Cam', tier: 2, cells: [C(1, 0), C(1, 1), C(1, 2), C(0, 2)] },
  { id: 'coil-s', label: 'Coil (S)', tier: 2, cells: [C(1, 0), C(2, 0), C(0, 1), C(1, 1)] },
  { id: 'coil-z', label: 'Coil (Z)', tier: 2, cells: [C(0, 0), C(1, 0), C(1, 1), C(2, 1)] },

  // ── Tier 3: pentominoes — moderate ──
  { id: 'boiler', label: 'Boiler', tier: 3, cells: [C(0, 0), C(1, 0), C(0, 1), C(1, 1), C(0, 2)] },
  { id: 'mainspring', label: 'Mainspring', tier: 3, cells: [C(0, 0), C(0, 1), C(0, 2), C(0, 3), C(1, 3)] },
  { id: 'aether-coil', label: 'Aether Coil', tier: 3, cells: [C(1, 0), C(1, 1), C(0, 2), C(1, 2), C(0, 3)] },
  { id: 'pendulum', label: 'Pendulum', tier: 3, cells: [C(1, 0), C(0, 1), C(1, 1), C(1, 2), C(1, 3)] },
  { id: 'governor', label: 'Governor', tier: 3, cells: [C(0, 0), C(1, 0), C(2, 0), C(1, 1), C(1, 2)] },

  // ── Tier 4: gnarly pentominoes ──
  { id: 'gyroscope', label: 'Gyroscope', tier: 4, cells: [C(1, 0), C(0, 1), C(1, 1), C(2, 1), C(1, 2)] },
  { id: 'chronoframe', label: 'Chronoframe', tier: 4, cells: [C(0, 0), C(2, 0), C(0, 1), C(1, 1), C(2, 1)] },
  { id: 'zigzag', label: 'Zigzag Manifold', tier: 4, cells: [C(0, 0), C(1, 0), C(1, 1), C(1, 2), C(2, 2)] },
  { id: 'escapement', label: 'Escapement', tier: 4, cells: [C(1, 0), C(2, 0), C(0, 1), C(1, 1), C(1, 2)] },
  { id: 'aether-cell', label: 'Aether Cell', tier: 4, cells: [C(0, 0), C(0, 1), C(1, 1), C(1, 2), C(2, 2)] },
] as const;

export function getShapesForTiers(tiers: readonly number[]): ShapeDef[] {
  const set = new Set(tiers);
  const out = SHAPES.filter((s) => set.has(s.tier));
  if (out.length === 0) throw new Error(`No shapes for tiers ${tiers.join(',')}`);
  return out;
}
