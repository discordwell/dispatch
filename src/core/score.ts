import type { GameState, RequestStatus } from './types';

/**
 * A post-shift performance breakdown, derived purely from the final GameState — no extra
 * bookkeeping during the sim. Every order's terminal status at the bell tells the story:
 * `delivered` reached its dock, `expired` lapsed on the clock, `assigned` was still aboard a
 * ship in flight when time ran out, `active` was posted but never picked up. Used by the
 * result screen to turn a bare §earnings into a readable debrief ("12 delivered · 3 expired").
 */
export interface ShiftSummary {
  /** Orders that reached their destination (their value is banked). */
  delivered: number;
  /** Orders that lapsed unclaimed before the bell — the clock beat you to them. */
  expired: number;
  /** Orders committed to a ship still in flight when the bell rang (value never banked). */
  inTransit: number;
  /** Orders still posted and unclaimed at the bell (neither taken nor expired). */
  unclaimed: number;
  /** Orders that ever went live this shift (delivered + expired + inTransit + unclaimed). */
  posted: number;
  /**
   * Of the orders the clock forced to a verdict (delivered or expired), the share you
   * delivered: delivered / (delivered + expired). 0 when none resolved either way.
   */
  completionRate: number;
  /** Final earnings banked. */
  banked: number;
  /** The level's earnings threshold. */
  threshold: number;
  /** Whether the shift cleared the threshold. */
  won: boolean;
}

function countBy(state: GameState, status: RequestStatus): number {
  let n = 0;
  for (const r of state.requests) if (r.status === status) n++;
  return n;
}

/** Fold the final GameState into a readable shift debrief. Pure; safe to call any time. */
export function summarizeShift(state: GameState): ShiftSummary {
  const delivered = countBy(state, 'delivered');
  const expired = countBy(state, 'expired');
  const inTransit = countBy(state, 'assigned');
  const unclaimed = countBy(state, 'active');
  const resolved = delivered + expired;
  return {
    delivered,
    expired,
    inTransit,
    unclaimed,
    posted: delivered + expired + inTransit + unclaimed,
    completionRate: resolved === 0 ? 0 : delivered / resolved,
    banked: state.earnings,
    threshold: state.config.threshold,
    won: state.outcome === 'won',
  };
}
