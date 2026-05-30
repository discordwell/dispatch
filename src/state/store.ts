import { step } from '../core/sim';
import type { GameState } from '../core/types';

export type Listener = (state: GameState) => void;

/**
 * Single source of truth. The loop batches many sim ticks per frame via advance()
 * then flush()es once; actions mutate via update() and notify immediately.
 */
export class Store {
  private state: GameState;
  private listeners = new Set<Listener>();

  constructor(initial: GameState) {
    this.state = initial;
  }

  getState(): GameState {
    return this.state;
  }

  /** Subscribe and receive the current state immediately. Returns an unsubscribe fn. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Advance the simulation without notifying (loop batches per frame). */
  advance(dtMs: number): void {
    step(this.state, dtMs);
  }

  /** Notify all subscribers. */
  flush(): void {
    for (const l of this.listeners) l(this.state);
  }

  /** Convenience for tests/headless: advance + flush. */
  tick(dtMs: number): void {
    this.advance(dtMs);
    this.flush();
  }

  /** Apply a mutation (an action) and notify immediately. */
  update(fn: (state: GameState) => void): void {
    fn(this.state);
    this.flush();
  }

  /** Replace the whole state (restart / next level). */
  reset(next: GameState): void {
    this.state = next;
    this.flush();
  }
}
