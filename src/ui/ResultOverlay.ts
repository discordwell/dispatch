import type { GameState } from '../core/types';
import { formatMoney } from './format';
import { LOSE_LINES, WIN_LINES, pickLine } from './flavor';

export interface ResultCallbacks {
  onReplay: () => void;
  onNext: () => void;
}

/** End-of-shift result: win/lose, the take vs the threshold, a flavor line, and what next. */
export class ResultOverlay {
  readonly el: HTMLElement;
  private titleEl: HTMLElement;
  private subEl: HTMLElement;
  private flavorEl: HTMLElement;
  private actionsEl: HTMLElement;
  private shown = false;

  constructor(parent: HTMLElement, cb: ResultCallbacks) {
    const el = document.createElement('div');
    el.className = 'result-overlay';
    el.innerHTML = `
      <div class="result-card">
        <div class="result-title"></div>
        <div class="result-sub"></div>
        <div class="result-flavor"></div>
        <div class="result-actions"></div>
      </div>`;
    parent.appendChild(el);
    this.el = el;
    this.titleEl = el.querySelector('.result-title')!;
    this.subEl = el.querySelector('.result-sub')!;
    this.flavorEl = el.querySelector('.result-flavor')!;
    this.actionsEl = el.querySelector('.result-actions')!;
    this.actionsEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'replay') cb.onReplay();
      else if (btn.dataset.act === 'next') cb.onNext();
    });
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.el.classList.remove('show');
  }

  show(s: GameState, hasNext: boolean): void {
    const won = s.outcome === 'won';
    this.el.classList.toggle('won', won);
    this.titleEl.textContent = won ? 'Shift Complete' : 'Shift’s End';
    this.subEl.innerHTML = won
      ? `You banked <b>${formatMoney(s.earnings)}</b> — clear of the ${formatMoney(s.config.threshold)} mark.`
      : `You banked <b>${formatMoney(s.earnings)}</b> — short of the ${formatMoney(s.config.threshold)} mark.`;
    this.flavorEl.textContent = pickLine(won ? WIN_LINES : LOSE_LINES, s.earnings);
    this.actionsEl.innerHTML =
      (won && hasNext ? `<button class="btn" data-act="next">Next Shift ▸</button>` : '') +
      `<button class="btn secondary" data-act="replay">Replay Shift</button>`;
    if (!this.shown) {
      this.shown = true;
      this.el.classList.add('show');
    }
  }
}
