// Síntese de voz (TTS em mandarim) e efeitos sonoros gerados via Web Audio.
import { state } from './state.js';

let voice = null;
const synth = window.speechSynthesis;

function score(v) {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/zh[-_]cn/i.test(v.lang)) s += 10;
  if (/natural|online|neural/.test(n)) s += 5;
  if (/xiaoxiao|xiaoyi|yunxi|google/.test(n)) s += 3;
  if (/hk|tw|cantonese|粤/.test(n + v.lang.toLowerCase())) s -= 8;
  return s;
}
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices().filter((v) => /^zh|cmn/i.test(v.lang));
  voice = vs.sort((a, b) => score(b) - score(a))[0] || null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const ttsSupported = !!synth;
export const hasChineseVoice = () => !!voice;
export const voiceName = () => voice?.name || null;

export function speak(text, { rate, slow = false } = {}) {
  return new Promise((resolve) => {
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = rate ?? (slow ? 0.5 : state.settings.ttsRate);
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    u.onend = end;
    u.onerror = end;
    setTimeout(end, 1500 + text.length * 900);
    // pequeno atraso evita bug do Chrome ao falar logo após cancel()
    setTimeout(() => synth.speak(u), 40);
  });
}
export const stopSpeaking = () => synth?.cancel();

// ---------- Efeitos sonoros ----------
let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function beep(freq, dur, { type = 'sine', when = 0, gain = 0.12, slide = 0 } = {}) {
  if (!state.settings.sound) return;
  try {
    const c = ac();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* áudio indisponível */ }
}

export const sfx = {
  tap: () => beep(900, 0.04, { gain: 0.05 }),
  correct: () => { beep(784, 0.12); beep(1175, 0.2, { when: 0.09 }); },
  wrong: () => beep(220, 0.28, { type: 'sawtooth', gain: 0.05, slide: 0.7 }),
  combo: () => [880, 1109, 1319].forEach((f, i) => beep(f, 0.1, { when: i * 0.05, gain: 0.07 })),
  complete: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.22, { type: 'triangle', when: i * 0.1 })),
  levelup: () => [392, 523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, { type: 'square', when: i * 0.12, gain: 0.05 })),
  coin: () => { beep(1319, 0.06, { gain: 0.06 }); beep(1760, 0.12, { when: 0.06, gain: 0.06 }); },
  start: () => beep(660, 0.08, { gain: 0.06, slide: 1.5 }),
};
