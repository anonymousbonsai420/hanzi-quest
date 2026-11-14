// Tela Hanzi: coleção de palavras com domínio e o modal de detalhes da palavra.
import { h } from '../lib/dom.js';
import { fmtRelDays } from '../lib/time.js';
import { modal } from '../ui/modal.js';
import { state } from '../state.js';
import { UNITS, ALL_WORDS, ALL_SENTENCES } from '../data.js';
import { mastery, MASTERY_LABEL, isLearned } from '../srs.js';
import { pinyinHTML } from '../pinyin.js';
import { speak } from '../audio.js';
import { writerAvailable, gridBox, animateLoop } from '../writer.js';
import { runSession } from '../session/runner.js';
import { rerender } from './rerender.js';

export function renderCollection(view) {
  const learned = ALL_WORDS.filter((w) => isLearned(w.id)).length;
  view.append(
    h('h1', { class: 'page-title' }, '🀄 Coleção de Hanzi'),
    h('p', { class: 'muted' }, `${learned} de ${ALL_WORDS.length} palavras desbloqueadas. Toque para ver ordem dos traços, exemplos e áudio.`),
    h('div', { class: 'legend small' }, [1, 2, 3, 4, 5].map((m) => h('span', { class: `lg-dot m${m}` }, MASTERY_LABEL[m]))));
  for (const u of UNITS) {
    view.append(h('h3', { class: 'col-unit', style: { '--uc': u.color } }, `${u.icon} ${u.zh} · ${u.title}`),
      h('div', { class: 'hz-grid' }, u.words.map((w) => {
        const m = mastery(w.id);
        return h('button', { class: `hz-card m${m} ${m ? '' : 'unseen'}`, onClick: () => wordModal(w) },
          h('span', { class: `hz ${w.h.length > 2 ? 'sm' : 'md'}` }, w.h),
          h('span', { class: 'py tiny', html: m ? pinyinHTML(w.p, { join: true }) : '?' }),
          h('span', { class: 'm-dots' }, [1, 2, 3, 4, 5].map((k) => h('i', { class: k <= m ? 'on' : '' }))));
      })));
  }
}

export async function wordModal(w) {
  const c = state.srs[w.id];
  const m = mastery(w.id);
  const strokes = h('div', { class: 'stroke-row' });
  const loops = [];
  if (writerAvailable()) {
    [...w.h].forEach((ch) => {
      const { wrap, target } = gridBox(120);
      strokes.append(wrap);
      loops.push(animateLoop(target, ch, 120));
    });
  }
  const ex = ALL_SENTENCES.filter((s) => s.plain.includes(w.h)).slice(0, 3);
  speak(w.h);
  const r = await modal({
    className: 'word-modal',
    body: h('div', { class: 'center' },
      h('button', { class: 'hz xxl', onClick: () => speak(w.h) }, w.h),
      h('div', { class: 'py big', html: pinyinHTML(w.p, { join: true }) }),
      h('div', { class: 'meaning big' }, w.m),
      h('div', { class: 'speakers center' }, h('button', { class: 'audio-btn', onClick: () => speak(w.h) }, '🔊'), h('button', { class: 'audio-btn slow', onClick: () => speak(w.h, { slow: true }) }, '🐢')),
      strokes,
      h('div', { class: 'word-meta' },
        h('span', { class: `pill m${m}` }, MASTERY_LABEL[m]),
        c && h('span', { class: 'pill' }, `Próxima revisão: ${fmtRelDays(c.due)}`),
        c && c.lapses > 0 && h('span', { class: 'pill' }, `Esquecida ${c.lapses}×`)),
      ex.length > 0 && h('div', { class: 'examples' }, h('h3', {}, 'Exemplos'),
        ex.map((s) => h('div', { class: 'example' },
          h('button', { class: 'audio-btn mini', onClick: () => speak(s.plain) }, '🔊'),
          h('div', {}, h('div', { class: 'hz-inline' }, s.h), h('div', { class: 'py small', html: pinyinHTML(s.p) }), h('div', { class: 'muted small' }, s.m)))))),
    actions: [
      w.h.length <= 3 ? { label: '✍️ Praticar escrita', value: 'write', class: 'gold' } : null,
      { label: '🎤 Praticar fala', value: 'speak', class: 'green' },
      { label: 'Fechar', value: null, class: 'ghost' },
    ].filter(Boolean),
  });
  loops.forEach((l) => l.stop());
  if (r === 'write') await runSession({ kind: 'practice', title: 'Caligrafia', items: [{ type: 'write', w, trace: true }, { type: 'write', w, trace: false }], srsMode: 'existing' });
  if (r === 'speak') await runSession({ kind: 'practice', title: 'Fala', items: [{ type: 'speak', item: { h: w.h, plain: w.h, p: w.p, m: w.m }, words: [w.id] }], srsMode: 'existing' });
  if (r) rerender();
}
