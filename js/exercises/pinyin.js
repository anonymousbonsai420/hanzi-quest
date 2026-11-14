// Exercício · Pinyin: digitar a pronúncia com os tons (aceita sandhi).
import { h } from '../lib/dom.js';
import { pinyinHTML, checkPinyin, markSyllable } from '../pinyin.js';
import { speakers, hanziBlock, answerHTML, prompt } from './blocks.js';

/** Digitar o pinyin com tons */
export async function pinyinExercise(stage, ex, io) {
  const w = ex.w;
  const input = h('input', { class: 'py-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ex.: ni3 hao3', 'aria-label': 'Pinyin' });
  const preview = h('div', { class: 'py-preview' });
  const update = () => {
    preview.innerHTML = /\d/.test(input.value) ? pinyinHTML(input.value.replace(/[^a-züv:0-5 ]/gi, '')) : '&nbsp;';
    io.setCheck(input.value.trim().length > 0);
  };
  input.addEventListener('input', update);
  const insert = (s) => { input.value += s; input.focus(); update(); };
  stage.append(
    prompt('Escreva o pinyin', 'Use números para os tons: 1 ¯  2 ˊ  3 ˇ  4 ˋ (neutro: sem número)'),
    h('div', { class: 'head-row' }, hanziBlock({ ...w, h: w.h }, { pinyin: false, meaning: true }), speakers(w.h, { big: false })),
    h('div', { class: 'py-field' }, input, preview),
    h('div', { class: 'tone-keys' }, [1, 2, 3, 4].map((t) => h('button', { class: `tone-key t${t}`, onClick: () => insert(String(t)) }, markSyllable('a' + t), h('small', {}, t))),
      h('button', { class: 'tone-key', onClick: () => insert('ü') }, 'ü'), h('button', { class: 'tone-key', onClick: () => insert(' ') }, '␣')));
  setTimeout(() => input.focus(), 50);
  io.setCheck(false);
  const act = await io.action();
  if (act === 'skip') return { skipped: true };
  input.disabled = true;
  const r = checkPinyin(input.value, w.p);
  let note = '';
  if (!r.ok && r.lettersOk) note = r.noTones ? 'As letras estão certas — faltaram os tons!' : 'Quase! As letras estão certas, confira os tons.';
  return { correct: r.ok, answer: answerHTML(w), note };
}
