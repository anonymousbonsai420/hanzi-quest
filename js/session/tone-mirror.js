// Espelho de tons: grava a voz e desenha a curva de altura sobre o contorno ideal.
import { h, pick, cssVar } from '../util.js';
import { state, save } from '../state.js';
import { track, checkAchievements } from '../game.js';
import { speak, sfx } from '../audio.js';
import { TONE_ITEMS } from '../data.js';
import { markSyllable, TONE_NAMES } from '../pinyin.js';
import { recordPitch, contour, classify, drawContours } from '../pitch.js';
import { mountOverlay, unmountOverlay } from './overlay.js';

export async function runToneMirror() {
  const el = mountOverlay('mirror');
  let filter = 0;
  const items = () => (filter ? TONE_ITEMS.filter((t) => t.tone === filter) : TONE_ITEMS);
  let it = pick(TONE_ITEMS);
  const close = h('button', { class: 'icon-btn close' }, '✕');
  const head = h('div', { class: 'mirror-head' });
  const canvas = h('canvas', { class: 'mirror-canvas' });
  const verdict = h('div', { class: 'mirror-verdict muted' }, 'Ouça o modelo e depois grave a sua voz.');
  const mic = h('button', { class: 'mic-btn' }, h('span', {}, '🎤'));
  const filterRow = h('div', { class: 'chip-row' }, [0, 1, 2, 3, 4].map((t) => h('button', { class: `chip ${t === 0 ? 'active' : ''}`, 'data-t': t }, t ? `${t}º tom` : 'Todos')));
  el.append(
    h('div', { class: 's-top' }, close, h('div', { class: 's-title' }, '📈 Espelho de tons')),
    h('div', { class: 'stage-wrap' }, h('div', { class: 'stage' },
      filterRow, head,
      h('div', { class: 'mirror-legend small' }, h('span', { class: 'lg target' }, 'modelo'), h('span', { class: 'lg user' }, 'sua voz')),
      canvas, verdict,
      h('div', { class: 'mirror-actions' },
        h('button', { class: 'btn ghost', onClick: () => speak(it.h) }, '🔊 Ouvir'), mic,
        h('button', { class: 'btn ghost', onClick: () => { next(); } }, 'Próximo ➜')),
      h('p', { class: 'muted small center' }, 'Dica: fale a sílaba de forma longa e clara, num lugar silencioso. A comparação é pela FORMA da curva, não pela altura absoluta da sua voz.'))));
  const colors = () => ({ grid: cssVar('--line'), target: cssVar(`--t${it.tone}`), user: cssVar('--ink') });
  const renderHead = () => {
    head.innerHTML = `<div class="hz xxl">${it.h}</div><div class="py big t${it.tone}">${markSyllable(it.p)}</div><div class="muted">${TONE_NAMES[it.tone]}</div>`;
    verdict.textContent = 'Ouça o modelo e depois grave a sua voz.';
    verdict.className = 'mirror-verdict muted';
    requestAnimationFrame(() => drawContours(canvas, it.tone, null, colors()));
  };
  const next = () => { const list = items(); let n; do { n = pick(list); } while (n === it && list.length > 1); it = n; renderHead(); speak(it.h); };
  filterRow.querySelectorAll('.chip').forEach((c) => (c.onclick = () => {
    filter = +c.dataset.t;
    filterRow.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === c));
    next();
  }));
  renderHead();
  setTimeout(() => speak(it.h), 300);
  let busy = false;
  mic.onclick = async () => {
    if (busy) return;
    busy = true;
    mic.classList.add('on');
    verdict.textContent = 'Gravando… fale agora!';
    try {
      const pts = await recordPitch(1700, (p) => {
        const c = contour(p);
        if (c) drawContours(canvas, it.tone, c, colors());
      });
      const c = contour(pts);
      drawContours(canvas, it.tone, c, colors());
      const guess = classify(c);
      if (!guess) { verdict.textContent = 'Não captei sua voz. Fale mais alto e mais longo.'; verdict.className = 'mirror-verdict'; }
      else if (guess === it.tone) {
        verdict.innerHTML = `✅ Isso! Soou como o <b>${guess}º tom</b>.`;
        verdict.className = 'mirror-verdict good';
        sfx.correct();
        state.stats.toneOk++; track('tone'); save(); checkAchievements();
      } else {
        verdict.innerHTML = `🤔 Soou mais como o <b>${guess}º tom</b>. Tente acompanhar a linha tracejada.`;
        verdict.className = 'mirror-verdict bad';
      }
    } catch {
      verdict.textContent = 'Não foi possível acessar o microfone.';
    }
    mic.classList.remove('on');
    busy = false;
  };
  await new Promise((r) => (close.onclick = r));
  unmountOverlay();
}
