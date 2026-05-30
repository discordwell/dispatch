// Verbatim Zybourne Clock lines — the meme's earnest, overwrought charm — used as flavor.
export const ZYBOURNE_LINES: readonly string[] = [
  'This, my darling, is the Zybourne Clock.',
  'A shameful path led them to seek it.',
  'Imagine four balls on the edge of a cliff… time works the same way.',
  'Johnny, no — we can’t stop, not until we get that clock!',
  'You always had a pension for the dramatic.', // (sic) — the misspelling is canon
];

export const WIN_LINES: readonly string[] = [
  'The mainspring holds. Johnny Five Aces would tip his hat.',
  'Cargo delivered, the future kept on schedule.',
  'A fortune in brass and aether. Well dispatched.',
];

export const LOSE_LINES: readonly string[] = [
  'The clock ran out before the coffers filled.',
  'Time works the same way — and it did not wait for you.',
  'The skies kept their secrets. Wind the mainspring and try again.',
];

export function pickLine(lines: readonly string[], seed: number): string {
  return lines[Math.abs(Math.round(seed)) % lines.length] ?? lines[0]!;
}
