// Ponto de entrada: barra superior, navegação entre telas e eventos globais.
import { $, h, bus } from './util.js';
import { state } from './state.js';
import { checkStreakOnLoad, refreshHearts, ensureQuests, levelInfo, nextHeartIn, HEART_MAX, practicedToday, checkAchievements } from './game.js';
import { renderPath, renderReview, renderPractice, renderCollection, renderProfile, setRerender, applyTheme, onboarding } from './screens.js';
import { dueIds } from './srs.js';
import { toast, modal, confetti } from './ui.js';
import { sfx } from './audio.js';

const TABS = {
  path: { icon: '🗺️', label: 'Trilha', render: renderPath },
  review: { icon: '🔁', label: 'Revisar', render: renderReview },
  practice: { icon: '🎯', label: 'Praticar', render: renderPractice },
  collection: { icon: '🀄', label: 'Hanzi', render: renderCollection },
  profile: { icon: '🐼', label: 'Perfil', render: renderProfile },
};

const currentTab = () => (location.hash.replace('#/', '') in TABS ? location.hash.replace('#/', '') : 'path');

function render() {
  const tab = currentTab();
  const view = $('#view');
  const scroll = tab === view.dataset.tab ? window.scrollY : 0;
  view.replaceChildren();
  view.dataset.tab = tab;
  TABS[tab].render(view);
  if (tab !== 'path') window.scrollTo(0, scroll);
  renderNav();
  renderTop();
}

function renderNav() {
  const tab = currentTab();
  const due = dueIds().length;
  $('#tabbar').replaceChildren(
    h('div', { class: 'brand' }, h('span', { class: 'brand-zh' }, '汉字之旅'), h('span', { class: 'brand-pt' }, 'Hanzi Quest')),
    ...Object.entries(TABS).map(([k, t]) => h('a', { href: `#/${k}`, class: `tab ${k === tab ? 'active' : ''}`, 'aria-current': k === tab ? 'page' : null },
      h('span', { class: 'tab-icon' }, t.icon), h('span', { class: 'tab-label' }, t.label),
      k === 'review' && due > 0 && h('span', { class: 'tab-badge' }, due > 99 ? '99+' : due))));
}

function renderTop() {
  const lv = levelInfo();
  const heartTitle = state.hearts >= HEART_MAX ? 'Vidas cheias' : `Próxima vida em ${Math.ceil(nextHeartIn() / 60e3)} min`;
  $('#topbar').replaceChildren(
    h('a', { href: '#/profile', class: 'tb-item level', title: `${lv.zh} · ${lv.pt}` }, h('span', { class: 'lv-badge' }, lv.level), h('span', { class: 'tb-xp' }, `${state.xp} XP`)),
    h('div', { class: 'tb-spacer' }),
    h('span', { class: `tb-item streak ${practicedToday() ? '' : 'cold'}`, title: 'Ofensiva (dias seguidos)' }, '🔥', state.streak),
    h('a', { href: '#/profile', class: 'tb-item', title: 'Moedas' }, '💰', state.coins),
    h('span', { class: 'tb-item hearts', title: heartTitle }, '❤️', state.hearts));
}

// ---------- celebrações (adiadas enquanto uma sessão está aberta) ----------
const queue = [];
function celebrate(fn) {
  if (document.body.classList.contains('in-session')) queue.push(fn);
  else fn();
}
bus.on('overlayClosed', () => { while (queue.length) queue.shift()(); });
bus.on('levelup', (lv) => celebrate(() => {
  sfx.levelup();
  confetti(200);
  modal({ title: `⭐ Nível ${lv.level}!`, body: `<div class="center"><div class="logo-big">${lv.zh}</div><p>Você agora é <b>${lv.pt}</b>.</p><p>+20 💰 de bônus</p></div>`, actions: [{ label: '太棒了！', value: true }] });
}));
bus.on('achievement', (a) => toast(`<b>Conquista: ${a.name}</b><br>${a.desc} · +15 💰`, { icon: a.icon, kind: 'gold', ms: 4500 }));
bus.on('quest', (q) => toast(`<b>Missão cumprida!</b><br>${q.text} · +${q.reward} 💰`, { icon: q.icon, kind: 'green' }));
bus.on('chest', (n) => toast(`<b>Baú do dia aberto!</b><br>Todas as missões cumpridas · +${n} 💰`, { icon: '🎁', kind: 'gold', ms: 5000 }));
bus.on('goal', (g) => toast(`<b>Meta diária atingida!</b><br>${g} XP hoje. 加油！`, { icon: '🎯', kind: 'green' }));
bus.on('freezeUsed', (n) => toast(`Um congelamento protegeu sua ofensiva (${n} dia${n > 1 ? 's' : ''}).`, { icon: '🧊', ms: 5000 }));
bus.on('streakLost', (n) => toast(`Sua ofensiva de ${n} dias acabou. Comece uma nova hoje!`, { icon: '🥶', ms: 5000 }));
bus.on('change', () => { renderTop(); });

// ---------- inicialização ----------
async function init() {
  applyTheme();
  setRerender(render);
  checkStreakOnLoad();
  refreshHearts();
  ensureQuests();
  window.addEventListener('hashchange', render);
  render();
  setInterval(() => { refreshHearts(); renderTop(); }, 30e3);
  if (!state.onboarded) {
    await onboarding();
    render();
  }
  checkAchievements();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// aguarda o Hanzi Writer (script defer) antes de iniciar
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
