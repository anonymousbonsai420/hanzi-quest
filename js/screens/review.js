// Tela Revisar: revisões vencidas (repetição espaçada), previsão e domínio do vocabulário.
import { h } from '../util.js';
import { state } from '../state.js';
import { ALL_WORDS } from '../data.js';
import { dueIds, forecast, mastery, MASTERY_LABEL, weakestIds } from '../srs.js';
import { buildReview } from '../builder.js';
import { runSession } from '../session/runner.js';
import { rerender } from './rerender.js';

export function renderReview(view) {
  const due = dueIds();
  const learned = Object.keys(state.srs).length;
  const fc = forecast(7);
  const maxF = Math.max(1, ...fc);
  const dist = [1, 2, 3, 4, 5].map((m) => ALL_WORDS.filter((w) => mastery(w.id) === m).length);
  const days = ['Hoje', 'Amanhã', ...Array.from({ length: 5 }, (_, i) => new Date(Date.now() + (i + 2) * 864e5).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))];

  view.append(
    h('h1', { class: 'page-title' }, '🔁 Revisão espaçada'),
    h('div', { class: 'card review-hero' },
      learned === 0
        ? h('div', {}, h('div', { class: 'big-num' }, '0'), h('p', {}, 'Você ainda não aprendeu palavras. Comece pela Trilha!'))
        : h('div', {},
          h('div', { class: 'big-num' }, due.length),
          h('p', {}, due.length ? `palavra${due.length > 1 ? 's' : ''} para revisar agora` : 'Tudo em dia! 🎉 Volte mais tarde.'),
          h('div', { class: 'btn-row' },
            due.length > 0 && h('button', { class: 'btn big', onClick: () => startReview(due.slice(0, 15)) }, `Revisar agora (${Math.min(15, due.length)})`),
            h('button', { class: `btn ${due.length ? 'ghost' : 'big'}`, onClick: () => startReview(weakestIds(10), true) }, '💪 Treinar palavras fracas')))),
    learned > 0 && h('div', { class: 'card' },
      h('div', { class: 'card-title' }, 'Previsão de revisões'),
      h('div', { class: 'forecast' }, fc.map((n, i) => h('div', { class: 'fc-col' },
        h('div', { class: 'fc-n' }, n || ''),
        h('div', { class: 'fc-bar', style: { height: `${(n / maxF) * 80 + 2}px` } }),
        h('div', { class: 'fc-d' }, days[i]))))),
    learned > 0 && h('div', { class: 'card' },
      h('div', { class: 'card-title' }, `Domínio do vocabulário · ${learned}/${ALL_WORDS.length}`),
      h('div', { class: 'mastery-bars' }, dist.map((n, i) => h('div', { class: 'mb-row' },
        h('span', { class: 'mb-label' }, MASTERY_LABEL[i + 1]),
        h('div', { class: 'meter' }, h('div', { class: `m${i + 1}`, style: { width: `${(n / Math.max(1, learned)) * 100}%` } })),
        h('span', { class: 'mb-n' }, n))))),
    h('div', { class: 'card info' },
      h('div', { class: 'card-title' }, 'Como funciona?'),
      h('p', {}, 'Cada palavra tem um intervalo de revisão. Quando você acerta, o intervalo cresce (1 dia → 3 dias → 1 semana → 1 mês…). Quando erra, ela volta a aparecer em poucos minutos. Assim você revisa exatamente quando está quase esquecendo — o momento em que a memória mais se fortalece.')));
}

async function startReview(ids, free = false) {
  if (!ids.length) return;
  await runSession({ kind: free ? 'practice' : 'review', title: free ? 'Palavras fracas' : 'Revisão', items: buildReview(ids), srsMode: 'existing' });
  rerender();
}
