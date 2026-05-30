import { describe, it, expect } from 'vitest';
import { applyResult, emptyProgress } from '../src/state/progress';

describe('progress', () => {
  it('tracks the best (max) earnings per level', () => {
    let p = emptyProgress();
    p = applyResult(p, 1, 3000, true);
    p = applyResult(p, 1, 2000, false);
    expect(p.best[1]).toBe(3000);
  });

  it('unlocks the next level only on a win', () => {
    let p = emptyProgress();
    expect(p.highestUnlocked).toBe(1);
    p = applyResult(p, 1, 100, false);
    expect(p.highestUnlocked).toBe(1); // a loss unlocks nothing
    p = applyResult(p, 1, 4000, true);
    expect(p.highestUnlocked).toBe(2);
    p = applyResult(p, 2, 8000, true);
    expect(p.highestUnlocked).toBe(3);
  });

  it('never regresses the unlock when replaying an earlier level', () => {
    let p: ReturnType<typeof emptyProgress> = { highestUnlocked: 3, best: {} };
    p = applyResult(p, 1, 5000, true);
    expect(p.highestUnlocked).toBe(3);
  });

  it('caps unlock at level 5', () => {
    let p: ReturnType<typeof emptyProgress> = { highestUnlocked: 5, best: {} };
    p = applyResult(p, 5, 99999, true);
    expect(p.highestUnlocked).toBe(5);
  });
});
