import { describe, it, expect } from 'vitest';
import {
  normalize,
  rotate90,
  rotateN,
  flip,
  orientedCells,
  boundingBox,
  cellsKey,
} from '../src/core/polyomino';
import type { Cell } from '../src/core/types';

const L: Cell[] = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];
const I: Cell[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
];
const S: Cell[] = [
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

describe('polyomino', () => {
  it('normalize translates to origin and is idempotent', () => {
    const offset = L.map((c) => ({ x: c.x + 5, y: c.y + 3 }));
    const n = normalize(offset);
    expect(Math.min(...n.map((c) => c.x))).toBe(0);
    expect(Math.min(...n.map((c) => c.y))).toBe(0);
    expect(cellsKey(normalize(n))).toBe(cellsKey(n));
    expect(normalize(n)).toEqual(n);
  });

  it('four 90° rotations return to identity', () => {
    let c: Cell[] = L;
    for (let i = 0; i < 4; i++) c = rotate90(c);
    expect(cellsKey(c)).toBe(cellsKey(L));
  });

  it('rotateN matches repeated rotate90', () => {
    expect(cellsKey(rotateN(S, 2))).toBe(cellsKey(rotate90(rotate90(S))));
    expect(cellsKey(rotateN(S, 0))).toBe(cellsKey(normalize(S)));
  });

  it('flipping twice returns to identity', () => {
    expect(cellsKey(flip(flip(S)))).toBe(cellsKey(S));
  });

  it('rotation and flip preserve cell count', () => {
    expect(rotate90(L)).toHaveLength(3);
    expect(flip(I)).toHaveLength(4);
    expect(rotateN(S, 3)).toHaveLength(4);
  });

  it('boundingBox tracks orientation', () => {
    expect(boundingBox(I)).toEqual({ w: 4, h: 1 });
    expect(boundingBox(rotate90(I))).toEqual({ w: 1, h: 4 });
    expect(boundingBox(L)).toEqual({ w: 2, h: 2 });
  });

  it('orientedCells(0,false) equals the normalized base', () => {
    expect(cellsKey(orientedCells(S, 0, false))).toBe(cellsKey(normalize(S)));
  });

  it('a flipped S differs from the unflipped S (chirality)', () => {
    expect(cellsKey(orientedCells(S, 0, true))).not.toBe(cellsKey(orientedCells(S, 0, false)));
  });
});
