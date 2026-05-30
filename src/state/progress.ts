/** Persisted campaign progress: which ace tiers are unlocked + best earnings per level. */
export interface Progress {
  highestUnlocked: number; // 1..5
  best: Record<number, number>; // levelIndex → best earnings
}

const KEY = 'dispatch.progress.v1';
const MAX_LEVEL = 5;

export function emptyProgress(): Progress {
  return { highestUnlocked: 1, best: {} };
}

/** Pure: fold a finished shift into progress (unlock next on a win, track best earnings). */
export function applyResult(p: Progress, levelIndex: number, earnings: number, won: boolean): Progress {
  const best: Record<number, number> = { ...p.best };
  best[levelIndex] = Math.max(best[levelIndex] ?? 0, earnings);
  const highestUnlocked =
    won && levelIndex >= p.highestUnlocked && levelIndex < MAX_LEVEL
      ? Math.min(MAX_LEVEL, levelIndex + 1)
      : p.highestUnlocked;
  return { highestUnlocked, best };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Partial<Progress>;
    const best = p.best && typeof p.best === 'object' ? (p.best as Record<number, number>) : {};
    const hi = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(p.highestUnlocked) || 1)));
    return { highestUnlocked: hi, best };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — progress just won't persist */
  }
}

export function recordResult(levelIndex: number, earnings: number, won: boolean): Progress {
  const next = applyResult(loadProgress(), levelIndex, earnings, won);
  saveProgress(next);
  return next;
}
