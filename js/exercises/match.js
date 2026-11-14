// Exercício · Pares: ligar hanzi ↔ significado.
import { h } from '../lib/dom.js';
import { shuffle } from '../lib/random.js';
import { speak, sfx } from '../audio.js';
import { prompt } from './blocks.js';

/** Ligar pares */
export async function matchExercise(stage, ex, io) {
  const words = ex.words;
  stage.append(prompt('Ligue os pares'));
  const left = shuffle(words), right = shuffle(words);
  let selL = null, selR = null, matched = 0, mistakes = 0;
  let finish;
  const done = new Promise((r) => (finish = r));
  const L = left.map((w) => h('button', { class: 'pair hzp' }, h('span', { class: 'hz md' }, w.h)));
  const R = right.map((w) => h('button', { class: 'pair' }, w.m));
  const check = () => {
    if (!selL || !selR) return;
    const [lb, lw] = selL, [rb, rw] = selR;
    if (lw === rw) {
      lb.classList.add('matched'); rb.classList.add('matched');
      lb.disabled = rb.disabled = true;
      sfx.correct();
      matched++;
      if (matched === words.length) setTimeout(finish, 400);
    } else {
      mistakes++;
      sfx.wrong();
      [lb, rb].forEach((b) => { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 450); });
    }
    lb.classList.remove('sel'); rb.classList.remove('sel');
    selL = selR = null;
  };
  L.forEach((b, i) => (b.onclick = () => { L.forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); selL = [b, left[i]]; speak(left[i].h); check(); }));
  R.forEach((b, i) => (b.onclick = () => { R.forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); selR = [b, right[i]]; sfx.tap(); check(); }));
  stage.append(h('div', { class: 'pairs' }, h('div', { class: 'pair-col' }, L), h('div', { class: 'pair-col' }, R)));
  io.setCheck(false);
  const res = await Promise.race([done.then(() => 'done'), io.action()]);
  if (res === 'skip') return { skipped: true };
  return { correct: mistakes <= 2, silent: mistakes <= 2, note: mistakes ? `${mistakes} erro(s)` : 'Sem erros!' };
}
