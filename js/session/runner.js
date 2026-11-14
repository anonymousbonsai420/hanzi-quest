// Executor de sessões de exercícios (lições, revisões e treinos) e a tela de resultados.
import { h } from '../lib/dom.js';
import { pick } from '../lib/random.js';
import { modal } from '../ui/modal.js';
import { confetti } from '../ui/confetti.js';
import { state, save } from '../state.js';
import { EXERCISES } from '../exercises/index.js';
import { grade, isLearned } from '../srs.js';
import { addXp, addCoins, loseHeart, touchStreak, track, checkAchievements, buy, PRICES, levelInfo } from '../game.js';
import { speak, stopSpeaking, sfx } from '../audio.js';
import { lessonsOf } from '../data.js';
import { mountOverlay, unmountOverlay } from './overlay.js';

const PRAISE = ['Excelente!', 'Muito bem!', '太好了！Tài hǎo le!', 'Perfeito!', 'Isso aí!', '很好！Hěn hǎo!', 'Mandou bem!'];
const ENCOURAGE = ['Resposta correta:', 'Quase! A resposta era:', 'Não foi dessa vez:'];

function idsOf(ex) {
  if (ex.w) return [ex.w.id];
  if (ex.type === 'match') return ex.words.map((w) => w.id);
  if (ex.words) return ex.words;
  return [];
}

/**
 * Executa uma sessão de exercícios.
 * opts: { kind:'lesson'|'review'|'practice', title, items, hearts, srsMode:'all'|'existing'|'none', unit, lesson }
 * Retorna o resumo ou null se o usuário saiu.
 */
export async function runSession(opts) {
  const { kind, title, items, hearts: useHearts = false, srsMode = 'all', unit, lesson } = opts;
  const el = mountOverlay();
  const fill = h('div', { class: 'bar-fill' });
  const heartsEl = h('div', { class: 's-hearts' });
  const comboEl = h('div', { class: 'combo' });
  const closeBtn = h('button', { class: 'icon-btn close', 'aria-label': 'Sair' }, '✕');
  const stage = h('div', { class: 'stage' });
  const fb = h('div', { class: 'fb' });
  const skipBtn = h('button', { class: 'btn ghost skip', hidden: true });
  const checkBtn = h('button', { class: 'btn check' }, 'Verificar');
  const foot = h('div', { class: 's-foot' }, h('div', { class: 'foot-inner' }, fb, h('div', { class: 'foot-btns' }, skipBtn, checkBtn)));
  el.append(
    h('div', { class: 's-top' }, closeBtn, h('div', { class: 'bar' }, fill), useHearts ? heartsEl : h('div', { class: 's-title' }, title || '')),
    comboEl,
    h('div', { class: 'stage-wrap' }, stage),
    foot);

  const renderHearts = () => (heartsEl.innerHTML = `<span class="heart">❤️</span> ${state.hearts}`);
  renderHearts();

  // ---- interface entre a sessão e os exercícios ----
  let pending = null, keyHandler = null, cleanups = [];
  const fire = (a) => { const p = pending; pending = null; p?.(a); };
  const io = {
    action: () => new Promise((res) => (pending = res)),
    setCheck(on, label = 'Verificar') { checkBtn.hidden = false; checkBtn.disabled = !on; checkBtn.textContent = label; },
    setSkip(label) { skipBtn.hidden = !label; if (label) skipBtn.textContent = label; },
    onKey(fn) { keyHandler = fn; },
    onCleanup(fn) { cleanups.push(fn); },
  };
  checkBtn.onclick = () => { if (!checkBtn.disabled) fire('check'); };
  skipBtn.onclick = () => fire('skip');
  const onKey = (e) => {
    if (document.querySelector('.modal-wrap')) return;
    if (e.key === 'Enter' && !checkBtn.disabled && !checkBtn.hidden) { e.preventDefault(); fire('check'); return; }
    if (e.target.tagName === 'INPUT') return;
    keyHandler?.(e);
  };
  document.addEventListener('keydown', onKey);

  let quitResolve;
  const quitP = new Promise((r) => (quitResolve = r));
  closeBtn.onclick = async () => {
    const ok = await modal({
      title: 'Sair da sessão?',
      body: 'O progresso desta sessão será perdido.',
      actions: [{ label: 'Continuar estudando', value: false, class: 'green' }, { label: 'Sair', value: true, class: 'ghost' }],
    });
    if (ok) quitResolve({ quit: true });
  };

  const cleanupExercise = () => { cleanups.forEach((f) => { try { f(); } catch {} }); cleanups = []; keyHandler = null; stopSpeaking(); };
  const finishUI = () => { cleanupExercise(); document.removeEventListener('keydown', onKey); unmountOverlay(); };

  // ---- laço principal ----
  const queue = items.map((ex) => ({ ...ex }));
  const total = queue.length;
  let completed = 0, combo = 0, maxCombo = 0, firstTry = 0, mistakes = 0;
  const wrongOnce = new Set();
  const wordStats = {};
  const flags = { noSpeak: false };
  const t0 = Date.now();

  while (queue.length) {
    const ex = queue.shift();
    if (ex.type === 'speak' && flags.noSpeak) { completed++; continue; }
    fill.style.width = `${(completed / total) * 100}%`;
    stage.replaceChildren();
    stage.scrollTop = 0;
    io.setSkip(null);
    io.setCheck(false);
    foot.classList.remove('ok', 'bad');
    fb.replaceChildren();
    stage.classList.remove('enter'); void stage.offsetWidth; stage.classList.add('enter');

    const res = await Promise.race([EXERCISES[ex.type](stage, ex, io), quitP]);
    if (res.quit) { finishUI(); return null; }

    if (res.intro) { idsOf(ex).forEach((id) => (wordStats[id] ??= { right: 0, wrong: 0 })); completed++; cleanupExercise(); continue; }
    if (res.skipped) {
      if (res.skipSpeak) flags.noSpeak = true;
      completed++; cleanupExercise(); continue;
    }

    for (const id of idsOf(ex)) {
      const st = (wordStats[id] ??= { right: 0, wrong: 0 });
      res.correct ? st.right++ : st.wrong++;
    }

    if (res.correct) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      if (!wrongOnce.has(ex)) firstTry++;
      completed++;
      if (res.kind === 'speak') { state.stats.speakOk++; track('speak'); }
      if (res.kind === 'write') { state.stats.writeOk++; track('write'); }
      if (res.kind === 'tone') { state.stats.toneOk++; track('tone'); }
      state.stats.correct++;
      combo % 5 === 0 ? sfx.combo() : sfx.correct();
    } else {
      combo = 0;
      mistakes++;
      state.stats.wrong++;
      wrongOnce.add(ex);
      sfx.wrong();
      // reinsere o exercício mais adiante para nova tentativa
      const pos = Math.min(queue.length, 2 + Math.floor(Math.random() * 3));
      queue.splice(pos, 0, ex);
      if (useHearts) {
        loseHeart();
        renderHearts();
        heartsEl.classList.add('pulse');
        setTimeout(() => heartsEl.classList.remove('pulse'), 600);
      }
    }
    comboEl.textContent = combo >= 3 ? `🔥 ${combo} seguidas!` : '';
    comboEl.classList.toggle('show', combo >= 3);
    fill.style.width = `${(completed / total) * 100}%`;

    // feedback
    if (!(res.silent && res.correct)) {
      foot.classList.add(res.correct ? 'ok' : 'bad');
      fb.innerHTML = `<div class="fb-title">${res.correct ? pick(PRAISE) : pick(ENCOURAGE)}</div>`
        + (res.answer ? `<div class="fb-ans">${res.answer}</div>` : '')
        + (res.note ? `<div class="fb-note">${res.note}</div>` : '');
      io.setSkip(null);
      io.setCheck(true, 'Continuar');
      const r2 = await Promise.race([io.action(), quitP]);
      if (r2?.quit) { finishUI(); return null; }
    }
    cleanupExercise();

    if (useHearts && state.hearts <= 0) {
      const choice = await modal({
        title: '💔 Sem vidas!',
        body: `<p>Suas vidas acabaram. Elas recarregam com o tempo (1 a cada 20 min), ou você pode recarregar agora.</p><p class="muted">Dica: revisões e treinos não gastam vidas — e cada revisão completa devolve 1 ❤️.</p>`,
        actions: [
          state.coins >= PRICES.refill ? { label: `Recarregar (${PRICES.refill} 💰)`, value: 'refill', class: 'gold' } : null,
          { label: 'Sair', value: 'quit', class: 'ghost' },
        ].filter(Boolean),
        dismissable: false,
      });
      if (choice === 'refill' && buy('refill')) { renderHearts(); continue; }
      finishUI();
      save();
      return null;
    }
  }

  fill.style.width = '100%';
  cleanupExercise();
  document.removeEventListener('keydown', onKey);
  save();
  return finishSession({ kind, unit, lesson, srsMode, wordStats, total, firstTry, mistakes, maxCombo, seconds: Math.round((Date.now() - t0) / 1000), title });
}

async function finishSession(r) {
  const { kind, unit, lesson, srsMode, wordStats, mistakes, maxCombo, seconds } = r;
  const perfect = mistakes === 0;
  // repetição espaçada: uma nota por palavra
  let graded = 0;
  if (srsMode !== 'none') {
    for (const [id, st] of Object.entries(wordStats)) {
      if (srsMode === 'existing' && !isLearned(id)) continue;
      const q = st.wrong === 0 ? (st.right >= 2 ? 5 : 4) : st.wrong === 1 ? 3 : 2;
      grade(id, q);
      graded++;
    }
  }
  const base = kind === 'lesson' ? 10 : 5;
  const xp = base + Math.floor(r.firstTry / 2) + (perfect ? 5 : 0) + Math.floor(maxCombo / 5) * 2;
  const coins = (kind === 'lesson' ? 5 : 2) + (perfect ? 5 : 0);
  const levelBefore = levelInfo().level;

  let unitDone = false;
  if (kind === 'lesson') {
    state.stats.lessons++;
    track('lesson');
    if (perfect) { state.stats.perfectLessons++; track('perfect'); }
    const prev = state.progress[unit.id] || 0;
    if (lesson.idx >= prev) {
      state.progress[unit.id] = lesson.idx + 1;
      if (lesson.idx + 1 === lessonsOf(unit).length) { state.stats.unitsDone++; unitDone = true; }
    }
  }
  if (kind === 'review') {
    state.stats.reviews += graded;
    track('review', graded);
    if (state.hearts < 5) { state.hearts++; }
  }
  state.stats.bestCombo = Math.max(state.stats.bestCombo, maxCombo);
  state.stats.minutes += Math.max(1, Math.round(seconds / 60));
  track('combo', maxCombo);
  addXp(xp);
  addCoins(coins);
  const streakUp = touchStreak();
  save();
  checkAchievements();

  await showResults({ ...r, xp, coins, perfect, streakUp, unitDone, leveled: levelInfo().level > levelBefore });
  return { ...r, xp, coins, perfect };
}

async function showResults(r) {
  const el = mountOverlay('results');
  const acc = Math.round((r.firstTry / Math.max(1, r.firstTry + r.mistakes)) * 100);
  const mm = Math.floor(r.seconds / 60), ss = String(r.seconds % 60).padStart(2, '0');
  const titles = { lesson: r.unitDone ? 'Unidade concluída! 🏅' : 'Lição concluída!', review: 'Revisão concluída!', practice: 'Treino concluído!' };
  const btn = h('button', { class: 'btn big' }, 'Continuar');
  el.append(h('div', { class: 'results-inner' },
    h('div', { class: 'res-mascot' }, r.perfect ? '🐉' : '🐼'),
    h('h1', {}, titles[r.kind] || 'Concluído!'),
    r.perfect && h('p', { class: 'perfect' }, '💎 Sem erros! +5 XP bônus'),
    h('div', { class: 'res-tiles' },
      tile('⚡', `+${r.xp}`, 'XP', 'gold'),
      tile('🎯', `${acc}%`, 'Precisão', 'jade'),
      tile('⏱️', `${mm}:${ss}`, 'Tempo', 'blue'),
      tile('🔥', r.maxCombo, 'Combo máx.', 'red')),
    h('p', { class: 'res-coins' }, `+${r.coins} 💰 moedas`),
    r.streakUp && h('div', { class: 'res-streak' }, h('span', { class: 'flame' }, '🔥'), h('div', {}, h('b', {}, `${state.streak} ${state.streak === 1 ? 'dia' : 'dias'} de ofensiva!`), h('div', { class: 'muted small' }, 'Volte amanhã para manter a chama acesa.'))),
    btn));
  sfx.complete();
  confetti();
  await new Promise((res) => {
    btn.onclick = res;
    const k = (e) => { if (e.key === 'Enter') { document.removeEventListener('keydown', k); res(); } };
    setTimeout(() => document.addEventListener('keydown', k), 400);
  });
  unmountOverlay();
}
function tile(icon, value, label, color) {
  return h('div', { class: `res-tile ${color}` }, h('div', { class: 'rt-label' }, label), h('div', { class: 'rt-val' }, icon, ' ', value));
}
