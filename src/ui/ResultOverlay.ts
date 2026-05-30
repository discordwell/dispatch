import type { GameState } from '../core/types';
import { formatMoney } from './format';
import { LOSE_LINES, WIN_LINES, pickLine } from './flavor';

export interface ResultCallbacks {
  onReplay: () => void;
  onNext: () => void;
  onLevelSelect: () => void;
}

export interface ResultOpts {
  hasNext: boolean;
  campaignComplete: boolean;
}

/** End-of-shift result: win/lose (or full-campaign victory), the take, a flavor line, what next. */
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
      else if (btn.dataset.act === 'levelselect') cb.onLevelSelect();
    });
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.el.classList.remove('show');
  }

  show(s: GameState, opts: ResultOpts): void {
    if (this.shown) return; // outcome is terminal; build once
    const won = s.outcome === 'won';
    const champ = opts.campaignComplete;
    this.el.classList.toggle('won', won);

    this.titleEl.textContent = champ ? 'Five Aces' : won ? 'Shift Complete' : 'Shift’s End';
    this.subEl.innerHTML = champ
      ? `All five ace tiers cleared — final shift banked <b>${formatMoney(s.earnings)}</b>.`
      : won
        ? `You banked <b>${formatMoney(s.earnings)}</b> — clear of the ${formatMoney(s.config.threshold)} mark.`
        : `You banked <b>${formatMoney(s.earnings)}</b> — short of the ${formatMoney(s.config.threshold)} mark.`;
    this.flavorEl.textContent = champ
      ? 'A shameful path led them to seek it… but you delivered. Johnny Five Aces tips his hat.'
      : pickLine(won ? WIN_LINES : LOSE_LINES, s.earnings);
    this.actionsEl.innerHTML =
      (won && opts.hasNext ? `<button class="btn" data-act="next">Next Shift ▸</button>` : '') +
      `<button class="btn secondary" data-act="replay">Replay</button>` +
      `<button class="btn secondary" data-act="levelselect">Level Select</button>`;

    this.shown = true;
    this.el.classList.add('show');
  }
}
