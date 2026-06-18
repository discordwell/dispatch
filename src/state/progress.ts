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
  // Track the TRUE best, including a net loss (a charter's fixed fee can push a shift's earnings
  // negative — intended). The identity for max is -Infinity, NOT 0: flooring at 0 would record a
  // §0 "best" no player ever earned, then `compareToBest` would surface that phantom on replay.
  best[levelIndex] = Math.max(best[levelIndex] ?? -Infinity, earnings);
  const highestUnlocked =
    won && levelIndex >= p.highestUnlocked && levelIndex < MAX_LEVEL
      ? Math.min(MAX_LEVEL, levelIndex + 1)
      : p.highestUnlocked;
  return { highestUnlocked, best };
}

/** How a finished shift stacks up against the level's standing record. */
export interface BestComparison {
  /** The level's best earnings before this shift, or null if the level was never finished before. */
  previous: number | null;
  /** This shift is the highest you've ever finished this level (a first-ever finish counts). */
  improved: boolean;
}

/**
 * Pure: compare a shift's earnings to the level's recorded best. Call this with the progress
 * as it stood BEFORE the shift is folded in (i.e. before applyResult/recordResult), so a fresh
 * `improved` reflects beating the *prior* record rather than the one this very shift just set.
 */
export function compareToBest(prior: Progress, levelIndex: number, earnings: number): BestComparison {
  const previous = prior.best[levelIndex] ?? null;
  return { previous, improved: earnings > (previous ?? -Infinity) };
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
