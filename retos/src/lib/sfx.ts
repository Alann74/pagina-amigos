"use client";
// Sonidos sintetizados con WebAudio (sin archivos). Se pueden desactivar desde el menú.
let ctx: AudioContext | null = null;
let enabled = true;
export function setSoundEnabled(v: boolean) { enabled = v; }

function ac(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null;
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new C();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.08, slideTo?: number) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}
function buzz(ms: number) { if (enabled && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); }
export const sfx = {
  smoke() { // ráfaga de humo: ruido filtrado que sube y se apaga
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * 2.2), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = "lowpass"; f.frequency.setValueAtTime(300, c.currentTime); f.frequency.exponentialRampToValueAtTime(2200, c.currentTime + 1.4);
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.1);
    src.connect(f).connect(g).connect(c.destination); src.start();
  },
  tick(i = 0) { tone(360 + Math.min(i, 24) * 38, 0, 0.05, "square", 0.035); },
  pop() { tone(480, 0, 0.07, "sine", 0.06, 880); buzz(8); },
  unlock() { ac(); },
  tap() { tone(520, 0, 0.07, "triangle", 0.05); buzz(6); },
  vote() { tone(440, 0, 0.08, "triangle", 0.07); tone(660, 0.08, 0.12, "triangle", 0.07); buzz(18); },
  heartbeat() { tone(70, 0, 0.18, "sine", 0.18, 45); tone(70, 0.22, 0.16, "sine", 0.14, 45); },
  flip() { tone(300, 0, 0.18, "sawtooth", 0.05, 900); },
  reveal() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.22, "square", 0.05)); },
  turn() { tone(784, 0, 0.1, "triangle", 0.08); tone(988, 0.12, 0.18, "triangle", 0.08); },
  joker() { [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.16, "sine", 0.07)); },
  no() { tone(220, 0, 0.18, "sawtooth", 0.06, 140); },
  ok() { tone(600, 0, 0.1, "triangle", 0.07); tone(900, 0.1, 0.16, "triangle", 0.07); },
};
