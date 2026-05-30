import './styles/tokens.css';
import './styles/hud.css';
import './styles/panels.css';
import './styles/packing.css';
import { createGameState } from './core/setup';
import { Store } from './state/store';
import { startLoop } from './engine/loop';
import { MapRenderer } from './render/MapRenderer';
import { GameUI } from './ui/GameUI';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app not found');
app.innerHTML = '';

const canvas = document.createElement('canvas');
canvas.id = 'map';
app.appendChild(canvas);

const store = new Store(createGameState(1));
const renderer = new MapRenderer(canvas);
const ui = new GameUI(app, canvas, store, renderer);

window.addEventListener('resize', () => {
  renderer.resize();
  ui.sync();
});

// Dev-only fast-forward: ?speed=8 multiplies sim time (default 1× — real play is unchanged).
const speed = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);
const loop = startLoop(store, () => ui.sync(), { timeScale: speed, isRunning: () => ui.isRunning() });

// Debug handle for wet-testing. `tick(ms)` advances sim time and re-syncs immediately,
// so tests can drive time even when rAF is throttled in a backgrounded tab.
(window as unknown as { __dispatch: unknown }).__dispatch = {
  store,
  renderer,
  ui,
  loop,
  tick: (ms: number) => {
    store.advance(ms);
    store.flush();
    ui.sync();
  },
};
