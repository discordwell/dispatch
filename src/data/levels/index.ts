import type { LevelConfig } from '../../core/types';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';

export const LEVELS: readonly LevelConfig[] = [level1, level2, level3, level4, level5];

export function getLevel(index: number): LevelConfig {
  const lvl = LEVELS.find((l) => l.index === index);
  if (!lvl) throw new Error(`No level with index ${index}`);
  return lvl;
}
