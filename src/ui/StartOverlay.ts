import type { GameState } from '../core/types';
import { formatMoney } from './format';
import { ZYBOURNE_LINES, pickLine } from './flavor';

/** Title / shift-briefing screen. Holds the sim paused until the player begins. */
export class StartOverlay {
  readonly el: HTMLElement;
  private levelEl: HTMLElement;
  private flavorEl: HTMLElement;

  constructor(parent: HTMLElement, onBegin: () => void) {
    const el = document.createElement('div');
    el.className = 'result-overlay start-overlay show';
    el.innerHTML = `
      <div class="result-card">
        <div class="start-title">DISPATCH</div>
        <div class="start-sub">Zybourne Clock Airways</div>
        <div class="start-level"></div>
        <div class="result-flavor"></div>
        <div class="result-actions"><button class="btn" data-act="begin">Begin Shift ▸</button></div>
      </div>`;
    parent.appendChild(el);
    this.el = el;
    this.levelEl = el.querySelector('.start-level')!;
    this.flavorEl = el.querySelector('.result-flavor')!;
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-act="begin"]')) onBegin();
    });
  }

  show(s: GameState): void {
    this.levelEl.innerHTML = `${s.config.rank} <b>${s.config.name}</b> · goal ${formatMoney(s.config.threshold)} in 10:00`;
    this.flavorEl.textContent = pickLine(ZYBOURNE_LINES, s.config.seed);
    this.el.classList.add('show');
  }

  hide(): void {
    this.el.classList.remove('show');
  }
}
