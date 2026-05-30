import { LEVELS } from '../data/levels';
import type { Progress } from '../state/progress';
import { formatMoney } from './format';

/** Title + level-select. Picking an unlocked ace tier starts that shift. */
export class TitleScreen {
  readonly el: HTMLElement;
  private gridEl: HTMLElement;

  constructor(parent: HTMLElement, onPick: (levelIndex: number) => void) {
    const el = document.createElement('div');
    el.className = 'result-overlay title-screen';
    el.innerHTML = `
      <div class="result-card title-card">
        <div class="start-title">DISPATCH</div>
        <div class="start-sub">Zybourne Clock Airways</div>
        <div class="result-flavor">It is the future. Route the airships, pack the holds, beat the clock.</div>
        <div class="level-grid"></div>
        <div class="title-hint">Earn past the threshold before the 10-minute shift ends.</div>
      </div>`;
    parent.appendChild(el);
    this.el = el;
    this.gridEl = el.querySelector('.level-grid')!;
    this.gridEl.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-level]');
      if (card) onPick(Number(card.dataset.level));
    });
  }

  show(p: Progress): void {
    this.gridEl.innerHTML = LEVELS.map((l) => {
      const unlocked = l.index <= p.highestUnlocked;
      const best = p.best[l.index];
      const bestLine = unlocked
        ? best != null
          ? `best ${formatMoney(best)}`
          : 'unplayed'
        : 'locked';
      return `<button class="level-card ${unlocked ? '' : 'locked'}" ${unlocked ? `data-level="${l.index}"` : 'disabled'}>
        <span class="lc-rank">${l.rank}</span>
        <span class="lc-name">${l.name}</span>
        <span class="lc-goal">goal ${formatMoney(l.threshold)}</span>
        <span class="lc-best">${bestLine}</span>
      </button>`;
    }).join('');
    this.el.classList.add('show');
  }

  hide(): void {
    this.el.classList.remove('show');
  }
}
