// Exercício · Reconhecimento: hanzi → significado e significado → hanzi.
import { h } from '../lib/dom.js';
import { shuffle } from '../lib/random.js';
import { pinyinHTML } from '../pinyin.js';
import { speak } from '../audio.js';
import { showPy, speakers, hanziBlock, answerHTML, prompt, choice } from './blocks.js';

/** Hanzi → significado */
export async function meaningExercise(stage, ex, io) {
  const w = ex.w;
  stage.append(prompt('O que significa?'), h('div', { class: 'head-row' }, hanziBlock(w), speakers(w.h, { big: false })));
  if (ex.autoplay !== false) speak(w.h);
  const opts = shuffle([w, ...ex.options]);
  const r = await choice(stage, io, { options: opts.map((o) => o.m), correctIdx: opts.indexOf(w) });
  return { ...r, answer: answerHTML(w) };
}

/** Significado → hanzi */
export async function hanziExercise(stage, ex, io) {
  const w = ex.w;
  stage.append(prompt(`Como se escreve “${w.m}”?`));
  const opts = shuffle([w, ...ex.options]);
  const r = await choice(stage, io, {
    grid: true,
    options: opts.map((o) => h('span', { class: 'opt-hz' }, h('span', { class: 'hz md' }, o.h), showPy() && h('span', { class: 'py small', html: pinyinHTML(o.p, { join: true }) }))),
    correctIdx: opts.indexOf(w),
    onSelect: (i) => speak(opts[i].h),
  });
  return { ...r, answer: answerHTML(w) };
}
