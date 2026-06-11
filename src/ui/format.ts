/** In-world currency mark. */
export const CUR = '§';

export function formatMoney(n: number): string {
  // Earnings can go negative (a charter's fixed fee is paid up front) — sign before the
  // currency mark ("−§350"), not "§-350".
  const r = Math.round(n);
  return (r < 0 ? '−' : '') + CUR + Math.abs(r).toLocaleString('en-US');
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
