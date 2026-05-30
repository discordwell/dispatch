/** In-world currency mark. */
export const CUR = '§';

export function formatMoney(n: number): string {
  return CUR + Math.round(n).toLocaleString('en-US');
}

/** ms → "M:SS" (clamped at 0). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** ms → compact "Ns" / "N:SS" for short countdowns. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  return formatClock(ms);
}
