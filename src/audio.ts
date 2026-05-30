/**
 * Tiny procedural sound — synthesized WebAudio blips, no asset files. The context is
 * created lazily and resumed on a user gesture (browser autoplay policy). Mute persists.
 */
let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem('dispatch.muted') === '1';
  } catch {
    return false;
  }
}

export function initAudio(): void {
  if (ctx) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = Ctor ? new Ctor() : null;
  } catch {
    ctx = null;
  }
}

export function resumeAudio(): void {
  try {
    void ctx?.resume();
  } catch {
    /* ignore */
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem('dispatch.muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export const sfx = {
  pickup: () => tone(420, 0.08, 'sine', 0.12),
  place: () => tone(300, 0.08, 'triangle', 0.16),
  rotate: () => tone(560, 0.05, 'square', 0.05),
  flip: () => tone(500, 0.05, 'square', 0.05),
  dispatch: () => {
    tone(300, 0.12, 'sawtooth', 0.1);
    tone(450, 0.14, 'sawtooth', 0.07, 0.06);
  },
  deliver: () => {
    tone(523, 0.1, 'triangle', 0.12);
    tone(784, 0.16, 'triangle', 0.1, 0.08);
  },
  expire: () => tone(190, 0.12, 'sawtooth', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.12)),
  lose: () => {
    tone(330, 0.3, 'sine', 0.12);
    tone(220, 0.42, 'sine', 0.12, 0.13);
  },
  click: () => tone(360, 0.05, 'sine', 0.1),
};
