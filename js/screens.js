// Telas principais: Trilha, Revisar, Praticar, Hanzi (coleção) e Perfil.
import { h, todayKey, addDays, fmtRelDays } from './util.js';
import { state, save, resetAll, exportData, importData } from './state.js';
import { UNITS, ALL_WORDS, ALL_SENTENCES, lessonsOf } from './data.js';
import { dueIds, forecast, mastery, MASTERY_LABEL, weakestIds, isLearned } from './srs.js';
import {
  ensureQuests, levelInfo, todayXp, ACHIEVEMENTS, buy, PRICES, HEART_MAX, nextHeartIn, practicedToday,
} from './game.js';
import { runSession, runSpeed, runToneMirror } from './session.js';
import {
  buildLearn, buildConsolidate, buildReview, buildTones, buildSpeaking, buildWriting, buildPinyin, buildListening,
} from './builder.js';
import { pinyinHTML } from './pinyin.js';
import { speak, voiceName, hasChineseVoice, ttsSupported } from './audio.js';
import { asrSupported, recordSupported } from './speech.js';
import { writerAvailable, gridBox, animateLoop } from './writer.js';
import { modal, toast } from './ui.js';
import { guideBody } from './guide.js';

let rerender = () => {};
export function setRerender(fn) { rerender = fn; }

// ---------------------------------------------------------------- Trilha
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

// ---------------------------------------------------------------- Revisar
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

// ---------------------------------------------------------------- Praticar
export function renderPractice(view) {
  const tiles = [
    { icon: '🎵', title: 'Treino de tons', desc: 'Ouça e identifique o tom de cada sílaba.', color: 'red', run: () => runSession({ kind: 'practice', title: 'Treino de tons', items: buildTones(10), srsMode: 'none' }) },
    { icon: '📈', title: 'Espelho de tons', desc: 'Veja a curva da sua voz sobre o contorno correto.', color: 'purple', run: runToneMirror, needs: 'mic' },
    { icon: '🎤', title: 'Laboratório de fala', desc: 'Pronuncie palavras e frases com correção automática.', color: 'jade', run: () => runSession({ kind: 'practice', title: 'Fala', items: buildSpeaking(8), srsMode: 'existing' }), needs: 'asr' },
    { icon: '🖌️', title: 'Caligrafia', desc: 'Escreva caracteres respeitando a ordem dos traços.', color: 'gold', run: () => runSession({ kind: 'practice', title: 'Caligrafia', items: buildWriting(6), srsMode: 'existing' }), needs: 'writer' },
    { icon: '🎧', title: 'Escuta e ditado', desc: 'Reconheça palavras e monte frases pelo áudio.', color: 'blue', run: () => runSession({ kind: 'practice', title: 'Escuta', items: buildListening(8), srsMode: 'existing' }) },
    { icon: '⌨️', title: 'Pinyin e tons', desc: 'Digite o pinyin com os tons corretos.', color: 'teal', run: () => runSession({ kind: 'practice', title: 'Pinyin', items: buildPinyin(8), srsMode: 'existing' }) },
    { icon: '⚡', title: 'Desafio relâmpago', desc: `60 segundos, o máximo de acertos. Recorde: ${state.stats.bestSpeed}`, color: 'orange', run: runSpeed },
  ];
  const warn = (n) => (n === 'asr' && !asrSupported ? 'Sem reconhecimento de fala neste navegador — modo gravar e comparar.' : n === 'writer' && !writerAvailable() ? 'Requer internet para carregar os traços.' : n === 'mic' && !recordSupported ? 'Microfone indisponível.' : null);
  view.append(
    h('h1', { class: 'page-title' }, '🎯 Praticar'),
    h('p', { class: 'muted' }, 'Treinos não gastam vidas e rendem XP. Use as palavras que você já aprendeu.'),
    h('div', { class: 'practice-grid' }, tiles.map((t) => h('button', {
      class: `practice-tile ${t.color}`,
      onClick: async () => { await t.run(); rerender(); },
    }, h('span', { class: 'pt-icon' }, t.icon), h('span', { class: 'pt-title' }, t.title), h('span', { class: 'pt-desc' }, t.desc),
    warn(t.needs) && h('span', { class: 'pt-warn' }, warn(t.needs))))));
}

// ---------------------------------------------------------------- Coleção
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

// ---------------------------------------------------------------- Perfil
export function renderProfile(view) {
  const lv = levelInfo();
  const learned = Object.keys(state.srs).length;
  const total = state.stats.correct + state.stats.wrong;
  const acc = total ? Math.round((state.stats.correct / total) * 100) : 0;

  view.append(
    h('div', { class: 'card profile-head' },
      h('div', { class: 'avatar' }, '🐼'),
      h('div', { class: 'grow' },
        h('div', { class: 'lvl' }, `Nível ${lv.level} · `, h('span', { class: 'hz-inline' }, lv.zh), ` ${lv.pt}`),
        h('div', { class: 'meter' }, h('div', { class: 'gold-fill', style: { width: `${lv.pct * 100}%` } })),
        h('div', { class: 'muted small' }, `${state.xp} XP · faltam ${lv.next - state.xp} XP para o nível ${lv.level + 1}`))),
    h('button', { class: 'card guide-cta', onClick: openGuide },
      h('span', { class: 'pt-icon' }, '📖'),
      h('div', {}, h('div', { class: 'card-title' }, 'Guia de estudo'), h('div', { class: 'muted small' }, 'Métodos comprovados e uma rotina diária para evoluir no mandarim.')),
      h('span', {}, '›')),
    h('div', { class: 'stat-grid' },
      stat('🔥', state.streak, 'Ofensiva atual'),
      stat('🏆', state.bestStreak, 'Melhor ofensiva'),
      stat('📚', learned, 'Palavras'),
      stat('🎯', `${acc}%`, 'Precisão'),
      stat('🎤', state.stats.speakOk, 'Falas certas'),
      stat('🖌️', state.stats.writeOk, 'Escritas certas'),
      stat('🎵', state.stats.toneOk, 'Tons certos'),
      stat('⏱️', `${state.stats.minutes}m`, 'Tempo de estudo')),
    h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Atividade (12 semanas)'), heatmap()),
    h('div', { class: 'card' },
      h('div', { class: 'card-title' }, `Conquistas · ${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}`),
      h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map((a) => h('div', { class: `ach ${state.achievements[a.id] ? 'got' : ''}`, title: a.desc },
        h('span', { class: 'ach-icon' }, a.icon), h('b', {}, a.name), h('small', {}, a.desc))))),
    shopCard(),
    settingsCard());
}
const stat = (icon, v, label) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, icon, ' ', v), h('div', { class: 'stat-l' }, label));

function heatmap() {
  const weeks = 12;
  const today = todayKey();
  const dow = (new Date().getDay() + 6) % 7; // segunda = 0
  const start = addDays(today, -(weeks * 7 - 1) - (6 - dow));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    const xp = state.days[k] || 0;
    const lvl = xp === 0 ? 0 : xp < 10 ? 1 : xp < 25 ? 2 : xp < 50 ? 3 : 4;
    cells.push(h('i', { class: `hm l${lvl} ${k > today ? 'future' : ''}`, title: `${k}: ${xp} XP` }));
  }
  return h('div', { class: 'heatmap' }, cells);
}

function shopCard() {
  const item = (icon, name, desc, price, key, disabled) => h('div', { class: 'shop-item' },
    h('span', { class: 'shop-icon' }, icon),
    h('div', { class: 'grow' }, h('b', {}, name), h('div', { class: 'muted small' }, desc)),
    h('button', {
      class: 'btn gold small', disabled: disabled || state.coins < price,
      onClick: () => { if (buy(key)) { toast(`${name} comprado!`, { icon }); rerender(); } },
    }, `${price} 💰`));
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, `Loja · você tem ${state.coins} 💰`),
    item('🧊', 'Congelar ofensiva', `Protege sua ofensiva se você faltar um dia (${state.freezes}/2 equipados).`, PRICES.freeze, 'freeze', state.freezes >= 2),
    item('❤️', 'Recarregar vidas', `Volta para ${HEART_MAX} vidas.`, PRICES.refill, 'refill', state.hearts >= HEART_MAX),
    item('💗', '+1 vida', 'Uma vida extra agora.', PRICES.heart, 'heart', state.hearts >= HEART_MAX));
}

function settingsCard() {
  const s = state.settings;
  const toggle = (key, label, desc) => h('label', { class: 'setting' },
    h('div', { class: 'grow' }, h('b', {}, label), desc && h('div', { class: 'muted small' }, desc)),
    h('input', { type: 'checkbox', class: 'switch', checked: s[key], onChange: (e) => { s[key] = e.target.checked; save(); if (key === 'theme') applyTheme(); } }));
  const goalSel = h('select', { onChange: (e) => { state.dailyGoal = +e.target.value; save(); rerender(); } },
    [[10, 'Casual · 10 XP'], [20, 'Regular · 20 XP'], [30, 'Sério · 30 XP'], [50, 'Intenso · 50 XP']].map(([v, l]) => h('option', { value: v, selected: state.dailyGoal === v }, l)));
  const themeSel = h('select', { onChange: (e) => { s.theme = e.target.value; save(); applyTheme(); } },
    [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => h('option', { value: v, selected: s.theme === v }, l)));
  const rate = h('input', { type: 'range', min: 0.5, max: 1.2, step: 0.05, value: s.ttsRate, onChange: (e) => { s.ttsRate = +e.target.value; save(); speak('你好，我是你的老师。'); } });
  const fileIn = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onChange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { importData(await f.text()); toast('Progresso importado!', { icon: '✅' }); rerender(); } catch { toast('Arquivo inválido.', { icon: '⚠️' }); }
  } });
  return h('div', { class: 'card settings' },
    h('div', { class: 'card-title' }, '⚙️ Configurações'),
    h('label', { class: 'setting' }, h('div', { class: 'grow' }, h('b', {}, 'Meta diária')), goalSel),
    toggle('showPinyin', 'Mostrar pinyin', 'Desative quando quiser treinar a leitura só dos caracteres.'),
    toggle('speaking', 'Exercícios de fala', asrSupported ? 'Reconhecimento de voz disponível ✓' : 'Sem reconhecimento de voz neste navegador (Chrome/Edge recomendados).'),
    toggle('writing', 'Exercícios de escrita'),
    toggle('sound', 'Efeitos sonoros'),
    h('label', { class: 'setting' }, h('div', { class: 'grow' }, h('b', {}, 'Velocidade da voz'), h('div', { class: 'muted small' }, ttsSupported ? (hasChineseVoice() ? `Voz: ${voiceName()}` : '⚠️ Nenhuma voz chinesa instalada — instale o pacote de idioma Chinês (Simplificado) no sistema.') : 'Síntese de voz indisponível.')), rate),
    h('label', { class: 'setting' }, h('div', { class: 'grow' }, h('b', {}, 'Tema')), themeSel),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost small', onClick: () => speak('你好！欢迎学习汉语。') }, '🔊 Testar voz'),
      h('button', { class: 'btn ghost small', onClick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([exportData()], { type: 'application/json' })), download: `hanzi-quest-${todayKey()}.json` });
        a.click();
      } }, '💾 Exportar progresso'),
      h('button', { class: 'btn ghost small', onClick: () => fileIn.click() }, '📂 Importar'), fileIn,
      h('button', { class: 'btn danger small', onClick: async () => {
        const ok = await modal({ title: 'Apagar todo o progresso?', body: 'Isso não pode ser desfeito.', actions: [{ label: 'Cancelar', value: false, class: 'ghost' }, { label: 'Apagar', value: true, class: 'danger' }] });
        if (ok) resetAll();
      } }, '🗑️ Reiniciar')));
}

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function openGuide() {
  modal({ title: '📖 Guia de estudo', body: guideBody(), className: 'guide-modal', actions: [{ label: 'Bora estudar!', value: true }] });
}

// ---------------------------------------------------------------- Boas-vindas
export async function onboarding() {
  const goal = await modal({
    className: 'onboard',
    dismissable: false,
    body: h('div', { class: 'center' },
      h('div', { class: 'logo-big' }, '汉字之旅'),
      h('h2', {}, 'Bem-vindo ao Hanzi Quest!'),
      h('p', {}, 'Aprenda mandarim com lições curtas, repetição espaçada, reconhecimento de fala e escrita dos caracteres traço a traço.'),
      h('p', { class: 'muted' }, 'Quanto tempo você quer estudar por dia?')),
    actions: [
      { label: '🌱 Casual · 5 min', value: 10, class: 'ghost' },
      { label: '📘 Regular · 10 min', value: 20, class: 'green' },
      { label: '🔥 Sério · 15 min', value: 30, class: 'ghost' },
      { label: '🐉 Intenso · 25 min', value: 50, class: 'ghost' },
    ],
  });
  state.dailyGoal = goal || 20;
  state.onboarded = true;
  save();
  await modal({
    title: 'Antes de começar',
    body: h('div', {},
      h('ul', { class: 'check-list' },
        h('li', {}, hasChineseVoice() ? '✅ Voz em mandarim encontrada.' : '⚠️ Nenhuma voz chinesa detectada. No Windows: Configurações → Hora e idioma → Fala → adicionar "Chinês (Simplificado)". No Edge/Chrome online geralmente já existe.'),
        h('li', {}, asrSupported ? '✅ Reconhecimento de fala disponível (precisa de internet e permissão de microfone).' : '⚠️ Seu navegador não reconhece fala. Use Chrome ou Edge para exercícios de pronúncia com correção.'),
        h('li', {}, writerAvailable() ? '✅ Escrita de caracteres pronta.' : '⚠️ Escrita precisa de internet para carregar os traços.')),
      h('p', {}, 'Dica: comece pela 1ª unidade e faça a revisão diária. Leia o 📖 Guia de estudo no Perfil quando puder.'),
      h('button', { class: 'btn ghost small', onClick: () => speak('你好！') }, '🔊 Testar áudio')),
    actions: [{ label: 'Começar! 加油！', value: true, class: 'green' }],
    dismissable: false,
  });
}
