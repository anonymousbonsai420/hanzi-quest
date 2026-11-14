// Exercício · Montar frase: ordenar as peças pela tradução ou pelo ditado.
import { h } from '../lib/dom.js';
import { shuffle } from '../lib/random.js';
import { pinyinHTML } from '../pinyin.js';
import { speak, sfx } from '../audio.js';
import { showPy, speakers, prompt, tokenPinyin } from './blocks.js';

/** Montar frase com peças */
export async function buildExercise(stage, ex, io) {
  const s = ex.s;
  const tokens = s.t.map((t, i) => ({ t, i }));
  const bank = shuffle([...tokens, ...(ex.distractors || []).map((t, k) => ({ t, i: 100 + k }))]);
  const answer = [];
  const line = h('div', { class: 'build-line' });
  const bankEl = h('div', { class: 'build-bank' });
  const tile = (tok) => h('button', { class: 'tile' },
    h('span', { class: 'hz sm' }, tok.t), showPy() && h('span', { class: 'py tiny', html: pinyinHTML(tokenPinyin(tok.t), { join: true }) }));
  const tiles = new Map(bank.map((tok) => [tok, tile(tok)]));
  const render = () => {
    line.replaceChildren(...answer.map((tok) => tiles.get(tok)));
    bankEl.replaceChildren(...bank.map((tok) => {
      const ph = h('span', { class: 'tile-slot' });
      if (!answer.includes(tok)) ph.append(tiles.get(tok));
      return ph;
    }));
    io.setCheck(answer.length > 0);
  };
  tiles.forEach((el, tok) => (el.onclick = () => {
    if (answer.includes(tok)) answer.splice(answer.indexOf(tok), 1);
    else { answer.push(tok); speak(tok.t); }
    sfx.tap();
    render();
  }));
  if (ex.listen) {
    stage.append(prompt('Monte o que você ouviu'), h('div', { class: 'listen-box' }, speakers(s.plain)));
    setTimeout(() => speak(s.plain), 250);
  } else {
    stage.append(prompt('Traduza para o chinês'), h('div', { class: 'build-source' }, h('span', { class: 'mascot' }, '🐼'), h('div', { class: 'bubble' }, s.m)));
  }
  stage.append(line, bankEl);
  render();
  const act = await io.action();
  if (act === 'skip') return { skipped: true };
  tiles.forEach((el) => (el.disabled = true));
  const ok = answer.map((x) => x.t).join('') === s.plain;
  speak(s.plain);
  return { correct: ok, answer: `<span class="hz-inline">${s.h}</span><br><span class="py-inline">${pinyinHTML(s.p)}</span><br>${s.m}` };
}
