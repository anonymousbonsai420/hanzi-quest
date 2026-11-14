// Exercício · Escuta: ouvir e escolher o caractere certo (sem pinyin).
import { h } from '../lib/dom.js';
import { shuffle } from '../lib/random.js';
import { speak } from '../audio.js';
import { speakers, answerHTML, prompt, choice } from './blocks.js';

/** Áudio → hanzi */
export async function listenExercise(stage, ex, io) {
  const w = ex.w;
  stage.append(prompt('O que você ouviu?'), h('div', { class: 'listen-box' }, speakers(w.h)));
  setTimeout(() => speak(w.h), 250);
  const opts = shuffle([w, ...ex.options]);
  const r = await choice(stage, io, {
    grid: true,
    options: opts.map((o) => h('span', { class: 'hz md' }, o.h)),
    correctIdx: opts.indexOf(w),
  });
  return { ...r, answer: answerHTML(w) };
}
