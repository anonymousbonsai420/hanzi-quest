// Repetição espaçada (variante do algoritmo SM-2).
import { state } from './state.js';

const DAY = 864e5, MIN = 6e4;

/**
 * Registra uma revisão. q: 0–5 (≥3 = lembrou).
 * Chamado uma vez por palavra ao final de cada sessão.
 */
export function grade(id, q) {
  const now = Date.now();
  const c = state.srs[id] || { ef: 2.5, iv: 0, reps: 0, lapses: 0, due: now, added: now };
  if (q < 3) {
    c.reps = 0;
    c.iv = 0;
    c.lapses++;
    c.due = now + 10 * MIN;
  } else {
    c.reps++;
    c.iv = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.iv * c.ef);
    if (q === 5 && c.reps > 2) c.iv = Math.round(c.iv * 1.15);
    c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    c.due = now + c.iv * DAY;
  }
  c.last = now;
  state.srs[id] = c;
  return c;
}

export const isLearned = (id) => !!state.srs[id];
export const learnedIds = () => Object.keys(state.srs);

/** 0 = nunca visto, 1 = aprendendo … 5 = dominado */
export function mastery(id) {
  const c = state.srs[id];
  if (!c) return 0;
  if (c.iv < 1) return 1;
  if (c.iv < 3) return 2;
  if (c.iv < 7) return 3;
  if (c.iv < 21) return 4;
  return 5;
}
export const MASTERY_LABEL = ['Nova', 'Aprendendo', 'Familiar', 'Boa', 'Forte', 'Dominada'];

export function dueIds(now = Date.now()) {
  return Object.entries(state.srs)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

/** Quantas revisões vencem em cada um dos próximos n dias (índice 0 = hoje). */
export function forecast(n = 7) {
  const out = Array(n).fill(0);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (const c of Object.values(state.srs)) {
    const d = Math.max(0, Math.floor((c.due - start.getTime()) / DAY));
    if (d < n) out[d]++;
  }
  return out;
}

/** Palavras mais fracas (para revisão livre). */
export function weakestIds(n = 10) {
  return Object.entries(state.srs)
    .sort((a, b) => (a[1].iv - b[1].iv) || (b[1].lapses - a[1].lapses))
    .slice(0, n)
    .map(([id]) => id);
}
