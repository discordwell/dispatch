import { describe, it, expect, afterEach } from 'vitest';
import { planTicks, startLoop } from '../src/engine/loop';
import type { Store } from '../src/state/store';

const base = { stepMs: 50, timeScale: 1, maxSteps: 8, maxFrameDtMs: 250, running: true };

describe('planTicks (fixed-timestep accumulator)', () => {
  it('runs exactly one step when a whole stepMs has accrued', () => {
    expect(planTicks(0, 50, base)).toEqual({ steps: 1, acc: 0, alpha: 0 });
  });

  it('accumulates a partial frame without stepping, exposing it as alpha', () => {
    const p = planTicks(0, 30, base);
    expect(p.steps).toBe(0);
    expect(p.acc).toBe(30);
    expect(p.alpha).toBeCloseTo(0.6);
  });

  it('carries leftover time across frames (30 + 30 → one step, 10 remains)', () => {
    const p = planTicks(30, 30, base);
    expect(p.steps).toBe(1);
    expect(p.acc).toBe(10);
    expect(p.alpha).toBeCloseTo(0.2);
  });

  it('clamps a huge frame delta to maxFrameDtMs (backgrounded-tab guard)', () => {
    // Without the clamp a 100s delta would advance ~2000 steps; clamped to 250ms → 5 steps.
    expect(planTicks(0, 100_000, base)).toEqual({ steps: 5, acc: 0, alpha: 0 });
  });

  it('scales accrued time by timeScale (fast-forward via ?speed=N)', () => {
    // 100ms · 8 = 800ms of sim → 16 steps; maxSteps is 64 at this scale so the cap is not hit.
    expect(planTicks(0, 100, { ...base, timeScale: 8, maxSteps: 64 })).toEqual({ steps: 16, acc: 0, alpha: 0 });
  });

  it('caps steps at maxSteps and carries the undrained remainder (spiral-of-death guard)', () => {
    const p = planTicks(10_000, 0, base);
    expect(p.steps).toBe(8); // capped, not 200
    expect(p.acc).toBe(10_000 - 8 * 50); // leftover deferred to later frames, never dropped
    expect(p.alpha).toBeCloseTo(9600 / 50);
  });

  it('never advances while paused, resetting the accumulator (start screen)', () => {
    expect(planTicks(40, 250, { ...base, running: false })).toEqual({ steps: 0, acc: 0, alpha: 0 });
  });
});

describe('startLoop wiring', () => {
  const realRaf = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  const realNow = performance.now;

  afterEach(() => {
    globalThis.requestAnimationFrame = realRaf;
    globalThis.cancelAnimationFrame = realCancel;
    performance.now = realNow;
  });

  /** Drive the loop manually: capture the rAF callback and a controllable clock. */
  function harness() {
    let frame: FrameRequestCallback | null = null;
    let advances = 0;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frame = cb;
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    let clock = 1000;
    performance.now = () => clock;
    const store = { advance: () => { advances++; } } as unknown as Store;
    return {
      store,
      tickBy: (ms: number) => {
        clock += ms;
        frame!(clock);
      },
      advances: () => advances,
    };
  }

  it('advances the store one fixed step per stepMs of real frame time', () => {
    const h = harness();
    startLoop(h.store, () => {}, { isRunning: () => true });
    h.tickBy(50); // one 20Hz tick
    expect(h.advances()).toBe(1);
    h.tickBy(150); // three more ticks
    expect(h.advances()).toBe(4);
  });

  it('does not advance sim time while paused (isRunning false)', () => {
    const h = harness();
    startLoop(h.store, () => {}, { isRunning: () => false });
    h.tickBy(250);
    expect(h.advances()).toBe(0);
  });

  it('stop() halts further advancement', () => {
    const h = harness();
    const loop = startLoop(h.store, () => {}, { isRunning: () => true });
    h.tickBy(50);
    expect(h.advances()).toBe(1);
    loop.stop();
    h.tickBy(50);
    expect(h.advances()).toBe(1); // unchanged after stop
  });
});
