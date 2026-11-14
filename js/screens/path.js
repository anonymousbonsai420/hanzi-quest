// Tela Trilha: meta diária, missões do dia e o caminho de unidades e lições.
import { h } from '../util.js';
import { state } from '../state.js';
import { UNITS, lessonsOf } from '../data.js';
import { ensureQuests, todayXp, buy, PRICES, nextHeartIn, practicedToday } from '../game.js';
import { buildLearn, buildConsolidate } from '../builder.js';
import { pinyinHTML } from '../pinyin.js';
import { speak } from '../audio.js';
import { modal, toast } from '../ui.js';
import { runSession } from '../session/runner.js';
import { rerender } from './rerender.js';

export function renderPath(view) {
  const q = ensureQuests();
  const goal = state.dailyGoal, xpToday = todayXp();
  const pct = Math.min(1, xpToday / goal);
  const R = 30, C = 2 * Math.PI * R;
  view.append(
    h('section', { class: 'cards-row' },
      h('div', { class: 'card goal-card' },
        h('div', { class: 'ring', html: `<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="${R}" class="ring-bg"/><circle cx="36" cy="36" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><span>${pct >= 1 ? '✓' : Math.round(pct * 100) + '%'}</span>` }),
        h('div', {},
          h('div', { class: 'card-title' }, 'Meta diária'),
          h('div', { class: 'muted' }, `${xpToday} / ${goal} XP hoje`),
          h('div', { class: `streak-line ${practicedToday() ? '' : 'cold'}` }, `🔥 ${state.streak} ${state.streak === 1 ? 'dia' : 'dias'}`, state.freezes ? h('span', { class: 'muted small' }, ` · 🧊 ${state.freezes}`) : null))),
      h('div', { class: 'card quests-card' },
        h('div', { class: 'card-title' }, 'Missões do dia ', h('span', { class: 'chest' }, q.chest ? '🎁✓' : '🎁')),
        q.list.map((m) => h('div', { class: `quest ${m.done ? 'done' : ''}` },
          h('span', { class: 'q-icon' }, m.icon),
          h('div', { class: 'q-main' },
            h('div', { class: 'q-text' }, m.text),
            h('div', { class: 'meter thin' }, h('div', { class: 'good', style: { width: `${(m.progress / m.target) * 100}%` } }))),
          h('span', { class: 'q-rew' }, m.done ? '✓' : `${m.reward}💰`))))));

  let currentNode = null;
  UNITS.forEach((u, i) => {
    const lessons = lessonsOf(u);
    const prev = UNITS[i - 1];
    const unlocked = i === 0 || (state.progress[prev.id] || 0) >= lessonsOf(prev).length;
    const done = state.progress[u.id] || 0;
    const complete = done >= lessons.length;
    const sec = h('section', { class: `unit ${unlocked ? '' : 'locked'}`, style: { '--uc': u.color } },
      h('div', { class: 'unit-banner' },
        h('div', {},
          h('div', { class: 'unit-kicker' }, `Unidade ${i + 1}${complete ? ' · concluída 🏅' : ''}`),
          h('h2', {}, h('span', { class: 'unit-zh' }, u.zh), ' ', u.title)),
        h('button', { class: 'unit-tip', title: 'Dica de gramática', onClick: () => showTip(u) }, '📜 Dica')));
    const path = h('div', { class: 'path' });
    lessons.forEach((l, j) => {
      const st = !unlocked ? 'locked' : j < done ? 'done' : j === done ? 'current' : 'locked';
      const icon = st === 'done' ? (l.kind === 'consolidate' ? '👑' : '✓') : st === 'current' ? (l.kind === 'consolidate' ? '🏆' : '★') : '🔒';
      const offset = Math.round(Math.sin((j + i * 2) * 1.1) * 70);
      const node = h('div', { class: `node-wrap ${st}`, style: { transform: `translateX(${offset}px)` } },
        st === 'current' && h('div', { class: 'node-bubble' }, l.kind === 'consolidate' ? 'Desafio!' : 'Começar'),
        h('button', {
          class: `node ${st} ${l.kind}`,
          'aria-label': `${l.name} (${st === 'done' ? 'concluída' : st === 'current' ? 'atual' : 'bloqueada'})`,
          onClick: () => startLesson(u, l, st),
        }, icon),
        h('div', { class: 'node-label' }, l.kind === 'learn' ? l.words.map((w) => w.h).join(' ') : l.name));
      if (st === 'current') currentNode = node;
      path.append(node);
    });
    sec.append(path);
    view.append(sec);
  });
  view.append(h('div', { class: 'path-end muted center' }, '🐉 Mais unidades em breve — continue revisando para dominar tudo!'));
  if (currentNode) requestAnimationFrame(() => currentNode.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

function showTip(u) {
  modal({
    title: `${u.icon} ${u.zh} · ${u.title}`,
    body: h('div', {},
      h('p', {}, u.tip),
      h('h3', {}, 'Frases da unidade'),
      h('ul', { class: 'tip-list' }, u.sentences.map((s) =>
        h('li', {}, h('button', { class: 'audio-btn mini', onClick: () => speak(s.plain) }, '🔊'),
          h('span', { class: 'hz-inline' }, s.h), h('div', { class: 'py small', html: pinyinHTML(s.p) }), h('div', { class: 'muted small' }, s.m))))),
    actions: [{ label: 'Entendi', value: true }],
  });
}

async function startLesson(unit, lesson, st) {
  if (st === 'locked') { toast('Complete a lição anterior para desbloquear.', { icon: '🔒' }); return; }
  if (state.hearts <= 0) {
    const r = await modal({
      title: '💔 Sem vidas',
      body: `<p>Próxima vida em ${Math.ceil(nextHeartIn() / 60e3)} min. Enquanto isso, faça uma revisão ou um treino (não gastam vidas e a revisão devolve 1 ❤️).</p>`,
      actions: [state.coins >= PRICES.refill ? { label: `Recarregar (${PRICES.refill} 💰)`, value: 'refill', class: 'gold' } : null, { label: 'Ok', value: null, class: 'ghost' }].filter(Boolean),
    });
    if (r !== 'refill' || !buy('refill')) return;
  }
  const items = lesson.kind === 'learn' ? buildLearn(unit, lesson) : buildConsolidate(unit);
  await runSession({ kind: 'lesson', title: lesson.name, items, hearts: true, unit, lesson, srsMode: 'all' });
  rerender();
}
