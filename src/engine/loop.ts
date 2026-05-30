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

/**
 * Fixed-timestep rAF loop. The simulation advances in discrete ticks (deterministic);
 * `onFrame` runs once per animation frame for rendering. dt is clamped so a backgrounded
 * tab doesn't fast-forward the whole shift on return.
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
    let dt = now - last;
    last = now;
    if (dt > config.MAX_FRAME_DT_MS) dt = config.MAX_FRAME_DT_MS;

    if (isRunning()) {
      acc += dt * timeScale;
      let steps = 0;
      while (acc >= stepMs && steps < maxSteps) {
        store.advance(stepMs);
        acc -= stepMs;
        steps++;
      }
    } else {
      acc = 0; // don't accumulate while paused (start screen)
    }
    onFrame(acc / stepMs);
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
