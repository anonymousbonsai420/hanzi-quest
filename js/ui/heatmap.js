// Mapa de atividade (um quadradinho por dia).
import { h } from '../lib/dom.js';
import { todayKey, addDays } from '../lib/time.js';

/** Mapa de atividade: um quadradinho por dia (semanas em colunas, segunda no topo). days: 'AAAA-MM-DD' → XP */
export function heatmap(days, weeks = 12) {
  const today = todayKey();
  const dow = (new Date().getDay() + 6) % 7; // segunda = 0
  const start = addDays(today, -(weeks * 7 - 1) - (6 - dow));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    const xp = days[k] || 0;
    const lvl = xp === 0 ? 0 : xp < 10 ? 1 : xp < 25 ? 2 : xp < 50 ? 3 : 4;
    cells.push(h('i', { class: `hm l${lvl} ${k > today ? 'future' : ''}`, title: `${k}: ${xp} XP` }));
  }
  return h('div', { class: 'heatmap' }, cells);
}
