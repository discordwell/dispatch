import { config } from '../config';
import type { Store } from '../state/store';

export interface GameLoop {
  stop(): void;
}

export interface LoopOpts {
  timeScale?: number;
  /** When this returns false, the loop renders but does not advance sim time (e.g. start screen). */
  isRunning?: () => boolean;
}

export interface TickPlan {
  /** Number of fixed sim steps to advance this frame. */
  steps: number;
  /** Leftover accumulated time (< stepMs unless the maxSteps cap was hit), carried to next frame. */
  acc: number;
  /** Render interpolation fraction acc/stepMs (∈[0,1) in steady state). */
  alpha: number;
}

/**
 * Pure fixed-timestep accumulator: given the carried-over `acc` and a raw frame delta, decide how
 * many discrete `stepMs` ticks to run. Deterministic and side-effect-free so it can be unit-tested
 * independently of `requestAnimationFrame`. Two guards live here:
 *  - `maxFrameDtMs` clamps a single frame's delta, so a backgrounded tab can't fast-forward the
 *    whole shift in one catch-up frame.
 *  - `maxSteps` caps ticks per frame (the spiral-of-death guard); leftover time stays in `acc`.
 * While paused (`running === false`) no time accrues — `acc` resets to 0 (start screen).
 */
export function planTicks(
  acc: number,
  rawDt: number,
  opts: { stepMs: number; timeScale: number; maxSteps: number; maxFrameDtMs: number; running: boolean },
): TickPlan {
  if (!opts.running) return { steps: 0, acc: 0, alpha: 0 };
  const dt = Math.min(rawDt, opts.maxFrameDtMs);
  let a = acc + dt * opts.timeScale;
  let steps = 0;
  while (a >= opts.stepMs && steps < opts.maxSteps) {
    a -= opts.stepMs;
    steps++;
  }
  return { steps, acc: a, alpha: opts.stepMs > 0 ? a / opts.stepMs : 0 };
}

/**
 * Fixed-timestep rAF loop. The simulation advances in discrete ticks (deterministic, via the pure
 * `planTicks` accumulator); `onFrame` runs once per animation frame for rendering.
 */
export function startLoop(store: Store, onFrame: (alpha: number) => void, opts: LoopOpts = {}): GameLoop {
  const timeScale = Math.max(1, opts.timeScale ?? 1);
  const isRunning = opts.isRunning ?? (() => true);
  const stepMs = 1000 / config.TICK_HZ;
  const maxSteps = Math.max(8, Math.ceil(timeScale) * 8);
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let alive = true;

  const frame = (now: number): void => {
    if (!alive) return;
    const plan = planTicks(acc, now - last, {
      stepMs,
      timeScale,
      maxSteps,
      maxFrameDtMs: config.MAX_FRAME_DT_MS,
      running: isRunning(),
    });
    last = now;
    for (let i = 0; i < plan.steps; i++) store.advance(stepMs);
    acc = plan.acc;
    onFrame(plan.alpha);
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return {
    stop(): void {
      alive = false;
      cancelAnimationFrame(raf);
    },
  };
}
