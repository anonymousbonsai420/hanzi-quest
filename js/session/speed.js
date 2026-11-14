// Desafio relâmpago: 60 segundos, o máximo de acertos possível.
import { h, esc } from '../lib/dom.js';
import { pick, shuffle } from '../lib/random.js';
import { sleep } from '../lib/time.js';
import { modal } from '../ui/modal.js';
import { confetti } from '../ui/confetti.js';
import { state, save } from '../state.js';
import { addXp, addCoins, touchStreak, checkAchievements } from '../game.js';
import { sfx } from '../audio.js';
import { practicePool } from '../builder.js';
import { speedRival } from '../friend-mode/cloud.js';
import { mountOverlay, unmountOverlay } from './overlay.js';

export async function runSpeed() {
  const pool = practicePool(6);
  const el = mountOverlay('speed');
  const DURATION = 60e3;
  let score = 0, streak = 0, end = Date.now() + DURATION, running = true;
  const timeFill = h('div', { class: 'bar-fill timer' });
  const scoreEl = h('div', { class: 'speed-score' }, '0');
  const stage = h('div', { class: 'stage speed-stage' });
  const close = h('button', { class: 'icon-btn close' }, '✕');
  el.append(h('div', { class: 's-top' }, close, h('div', { class: 'bar' }, timeFill), scoreEl), h('div', { class: 'stage-wrap' }, stage));
  let quit = false;
  close.onclick = () => { quit = true; running = false; };

  const tick = () => {
    const left = end - Date.now();
    timeFill.style.width = `${Math.max(0, left / DURATION) * 100}%`;
    timeFill.classList.toggle('danger', left < 10e3);
    if (left <= 0) running = false;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  let last = null;
  while (running) {
    let w;
    do { w = pick(pool); } while (w === last && pool.length > 1);
    last = w;
    const reverse = Math.random() < 0.35;
    const others = shuffle(pool.filter((o) => o !== w && o.m !== w.m)).slice(0, 3);
    const opts = shuffle([w, ...others]);
    stage.replaceChildren(
      h('div', { class: 'speed-q' }, reverse ? h('div', { class: 'meaning big' }, w.m) : h('div', { class: 'hz xl' }, w.h)),
      h('div', { class: `opts ${reverse ? 'grid' : ''}` }, opts.map((o, i) => h('button', { class: 'opt', 'data-i': i }, reverse ? h('span', { class: 'hz md' }, o.h) : o.m))));
    const chosen = await new Promise((res) => {
      stage.querySelectorAll('.opt').forEach((b) => (b.onclick = () => res(+b.dataset.i)));
      const k = (e) => { const n = +e.key; if (n >= 1 && n <= 4) { document.removeEventListener('keydown', k); res(n - 1); } };
      document.addEventListener('keydown', k);
      const poll = setInterval(() => { if (!running) { clearInterval(poll); document.removeEventListener('keydown', k); res(-1); } }, 100);
    });
    if (chosen < 0) break;
    const btns = stage.querySelectorAll('.opt');
    const ok = opts[chosen] === w;
    btns[opts.indexOf(w)].classList.add('right');
    if (!ok) { btns[chosen].classList.add('wrong'); sfx.wrong(); streak = 0; end -= 3000; }
    else { score++; streak++; sfx.correct(); if (streak % 5 === 0) end += 3000; }
    scoreEl.textContent = score;
    scoreEl.classList.add('bump'); setTimeout(() => scoreEl.classList.remove('bump'), 200);
    await sleep(ok ? 250 : 700);
  }
  unmountOverlay();
  if (quit) return null;
  const best = score > state.stats.bestSpeed;
  state.stats.bestSpeed = Math.max(state.stats.bestSpeed, score);
  const xp = Math.max(2, score);
  addXp(xp);
  addCoins(Math.floor(score / 3));
  touchStreak();
  save();
  checkAchievements();
  sfx.complete();
  if (best && score > 0) confetti();
  const rival = speedRival();
  const rivalLine = !rival ? ''
    : score > rival.speed_record ? `<p class="perfect">${esc(rival.avatar)} Você superou o recorde de ${esc(rival.display_name)} (${rival.speed_record})!</p>`
    : `<p class="muted">${esc(rival.avatar)} Recorde da turma: ${esc(rival.display_name)} · ${rival.speed_record}</p>`;
  await modal({
    title: '⚡ Tempo esgotado!',
    body: `<div class="center"><div class="big-num">${score}</div><p>acertos em 60 segundos</p>${best && score > 0 ? '<p class="perfect">🏆 Novo recorde!</p>' : `<p class="muted">Recorde: ${state.stats.bestSpeed}</p>`}${rivalLine}<p>+${xp} XP · +${Math.floor(score / 3)} 💰</p><p class="muted small">Erros custam 3 s; cada 5 acertos seguidos dão +3 s.</p></div>`,
    actions: [{ label: 'Continuar', value: true }],
  });
  return score;
}
