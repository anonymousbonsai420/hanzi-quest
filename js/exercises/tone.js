// Exercício · Tons: ouvir a sílaba e identificar o tom.
import { h } from '../lib/dom.js';
import { toneSVG, markSyllable, TONE_NAMES } from '../pinyin.js';
import { speak } from '../audio.js';
import { speakers, prompt, choice } from './blocks.js';

/** Identificar o tom */
export async function toneExercise(stage, ex, io) {
  const it = ex.item;
  stage.append(prompt('Qual tom você ouviu?', `Sílaba: ${it.syl}`), h('div', { class: 'listen-box' }, speakers(it.h)));
  setTimeout(() => speak(it.h), 250);
  const r = await choice(stage, io, {
    grid: true,
    options: [1, 2, 3, 4].map((t) => h('span', { class: 'tone-opt', html: `${toneSVG(t)}<b class="t${t}">${markSyllable(it.syl + t)}</b><small>${t}º tom</small>` })),
    correctIdx: it.tone - 1,
  });
  return { ...r, kind: 'tone', answer: `<span class="hz-inline">${it.h}</span> <b class="t${it.tone}">${markSyllable(it.p)}</b> — ${TONE_NAMES[it.tone]}` };
}
