// Blocos reutilizáveis pelos exercícios: áudio, bloco de hanzi, enunciado, resposta e múltipla escolha.
import { h } from '../lib/dom.js';
import { pinyinHTML } from '../pinyin.js';
import { speak, sfx } from '../audio.js';
import { WORDS } from '../data.js';
import { state } from '../state.js';

export const showPy = () => state.settings.showPinyin;

export function speakers(text, { big = true } = {}) {
  return h('div', { class: 'speakers' },
    h('button', { class: `audio-btn ${big ? 'big' : ''}`, title: 'Ouvir', 'aria-label': 'Ouvir', onClick: () => speak(text) }, '🔊'),
    h('button', { class: 'audio-btn slow', title: 'Ouvir devagar', 'aria-label': 'Ouvir devagar', onClick: () => speak(text, { slow: true }) }, '🐢'));
}

export function hanziBlock(item, { pinyin = showPy(), meaning = false, size = 'xl', join = true } = {}) {
  return h('div', { class: 'hz-block' },
    h('button', { class: `hz ${size}`, title: 'Ouvir', onClick: () => speak(item.plain || item.h) }, item.h),
    pinyin && h('div', { class: 'py', html: pinyinHTML(item.p, { join }) }),
    meaning && h('div', { class: 'meaning' }, item.m));
}

export const answerHTML = (w, join = true) =>
  `<span class="hz-inline">${w.h}</span> <span class="py-inline">${pinyinHTML(w.p, { join })}</span> — ${w.m}`;

export function prompt(text, sub) {
  return h('div', { class: 'ex-prompt' }, h('h2', {}, text), sub && h('p', { class: 'muted' }, sub));
}

export function tokenPinyin(tok) {
  if (WORDS[tok]) return WORDS[tok].p;
  return [...tok].map((c) => WORDS[c]?.p || '').join(' ');
}

/** Exercício genérico de múltipla escolha. */
export async function choice(stage, io, { options, correctIdx, onSelect, grid = false }) {
  let sel = -1;
  const btns = options.map((o, i) =>
    h('button', { class: 'opt', onClick: () => select(i) }, h('span', { class: 'opt-k' }, i + 1), h('span', { class: 'opt-label' }, o)));
  function select(i) {
    sel = i;
    btns.forEach((b, j) => b.classList.toggle('sel', j === i));
    sfx.tap();
    onSelect?.(i);
    io.setCheck(true);
  }
  stage.append(h('div', { class: `opts ${grid ? 'grid' : ''}` }, btns));
  io.setCheck(false);
  io.onKey((e) => { const n = +e.key; if (n >= 1 && n <= options.length) select(n - 1); });
  const act = await io.action();
  if (act === 'skip') return { skipped: true };
  btns.forEach((b, j) => { b.disabled = true; if (j === correctIdx) b.classList.add('right'); else if (j === sel) b.classList.add('wrong'); });
  return { correct: sel === correctIdx };
}
