import type { GameState } from '../core/types';
import { formatClock, formatMoney } from './format';

export class Hud {
  readonly el: HTMLElement;
  private rankEl: HTMLElement;
  private nameEl: HTMLElement;
  private clockEl: HTMLElement;
  private earnEl: HTMLElement;
  private earnValEl: HTMLElement;
  private goalEl: HTMLElement;
  private fillEl: HTMLElement;

  constructor(parent: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-left">
        <span class="rank"></span><span class="lvl-name"></span>
      </div>
      <div class="hud-mid">
        <span class="clock">0:00</span>
        <span class="clock-label">shift remaining</span>
      </div>
      <div class="hud-right">
        <div class="earn">
          <span class="earn-val">§0</span>
          <span class="earn-goal"></span>
        </div>
        <div class="bar"><div class="bar-fill"></div></div>
      </div>`;
    parent.appendChild(el);
    this.el = el;
    this.rankEl = el.querySelector('.rank')!;
    this.nameEl = el.querySelector('.lvl-name')!;
    this.clockEl = el.querySelector('.clock')!;
    this.earnEl = el.querySelector('.earn')!;
    this.earnValEl = el.querySelector('.earn-val')!;
    this.goalEl = el.querySelector('.earn-goal')!;
    this.fillEl = el.querySelector('.bar-fill')!;
  }

  update(s: GameState): void {
    this.rankEl.textContent = s.config.rank;
    this.nameEl.textContent = s.config.name;

    const left = s.config.durationMs - s.clockMs;
    this.clockEl.textContent = formatClock(left);
    this.clockEl.classList.toggle('low', left <= 60_000 && s.outcome === 'playing');

    this.earnValEl.textContent = formatMoney(s.earnings);
    this.goalEl.textContent = `goal ${formatMoney(s.config.threshold)}`;
    const met = s.earnings >= s.config.threshold;
    this.earnEl.classList.toggle('met', met);
    this.fillEl.classList.toggle('met', met);
    this.fillEl.style.width = `${Math.min(100, (s.earnings / s.config.threshold) * 100)}%`;
  }
}
