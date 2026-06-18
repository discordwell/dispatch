import { describe, it, expect } from 'vitest';
import { applyResult, compareToBest, emptyProgress } from '../src/state/progress';

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

  it('records a true (possibly negative) best — a net-negative charter shift is NOT floored to 0', () => {
    let p = emptyProgress();
    p = applyResult(p, 1, -500, false); // bombed a charter; banked a net loss
    expect(p.best[1]).toBe(-500); // honest, not a phantom §0
    p = applyResult(p, 1, -200, false); // a real improvement over -500
    expect(p.best[1]).toBe(-200);
    p = applyResult(p, 1, -900, false); // a worse shift never regresses the best
    expect(p.best[1]).toBe(-200);
  });
});

describe('compareToBest', () => {
  it('treats a first-ever finish as setting a record (no prior best to show)', () => {
    expect(compareToBest(emptyProgress(), 1, 1500)).toEqual({ previous: null, improved: true });
  });

  it('flags a strictly higher take as a new best, reporting the prior bar', () => {
    const p = applyResult(emptyProgress(), 1, 1500, true);
    expect(compareToBest(p, 1, 1800)).toEqual({ previous: 1500, improved: true });
  });

  it('does not flag a tie as an improvement (strictly greater)', () => {
    const p = applyResult(emptyProgress(), 1, 1500, true);
    expect(compareToBest(p, 1, 1500)).toEqual({ previous: 1500, improved: false });
  });

  it('reports the standing best when this shift fell short', () => {
    const p = applyResult(emptyProgress(), 1, 1500, true);
    expect(compareToBest(p, 1, 900)).toEqual({ previous: 1500, improved: false });
  });

  it('counts a new best even on a losing shift (best tracks earnings, not wins)', () => {
    // a prior loss recorded §400; a higher-earning loss still beats the record
    const p = applyResult(emptyProgress(), 2, 400, false);
    expect(compareToBest(p, 2, 700)).toEqual({ previous: 400, improved: true });
  });

  it('is independent per level', () => {
    const p = applyResult(emptyProgress(), 1, 5000, true);
    expect(compareToBest(p, 3, 100)).toEqual({ previous: null, improved: true });
  });

  it('reports a sub-zero improvement honestly (no phantom §0 record after a net loss)', () => {
    // A floored-at-0 best would make previous=0 and report this real improvement as a failure.
    const p = applyResult(emptyProgress(), 1, -500, false);
    expect(compareToBest(p, 1, -200)).toEqual({ previous: -500, improved: true });
  });
});
