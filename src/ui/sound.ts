export type SoundKind = 'move' | 'capture' | 'check' | 'end';

// Synthesised with Web Audio: no audio files, so nothing to license or attribute under the GPL.
const NOTES: Record<SoundKind, { freq: number; at: number; dur: number; type: OscillatorType }[]> = {
  move: [{ freq: 320, at: 0, dur: 0.06, type: 'triangle' }],
  capture: [{ freq: 170, at: 0, dur: 0.1, type: 'square' }],
  check: [
    { freq: 620, at: 0, dur: 0.08, type: 'sine' },
    { freq: 830, at: 0.08, dur: 0.12, type: 'sine' },
  ],
  end: [
    { freq: 440, at: 0, dur: 0.15, type: 'sine' },
    { freq: 330, at: 0.15, dur: 0.15, type: 'sine' },
    { freq: 220, at: 0.3, dur: 0.3, type: 'sine' },
  ],
};

const KEY = 'zugzwang.sound.muted';

export function soundKind(san: string, isLast: boolean): SoundKind {
  if (isLast) return 'end';
  if (/[+#]/.test(san)) return 'check';
  return san.includes('x') ? 'capture' : 'move';
}

/** The stored choice wins; without one, reduced motion starts muted. */
export function readMuted(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // storage blocked: fall through to the default
  }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function storeMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    // shortcut: the choice lasts only until reload when storage is blocked, never worth an error
  }
}

let ctx: AudioContext | undefined;

export function playSound(kind: SoundKind): void {
  if (typeof AudioContext === 'undefined') return;
  ctx ??= new AudioContext();
  const now = ctx.currentTime;
  for (const { freq, at, dur, type } of NOTES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now + at);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + dur);
  }
}
