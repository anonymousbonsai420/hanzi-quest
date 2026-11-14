// Modo Amigos: a aba "Amigos" — boas-vindas, perfil, pedidos de amizade, placar e adicionar amigo.
import { h } from '../lib/dom.js';
import { todayKey, addDays, dayDiff, fmtDate, ago } from '../lib/time.js';
import { modal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { share } from '../ui/share.js';
import { rerender } from '../screens/rerender.js';
import { act } from './actions.js';
import { state } from '../state.js';
import { levelInfo, checkAchievements } from '../game.js';
import * as cloud from './cloud.js';
import { signupModal, loginModal, profileModal } from './forms.js';
import { compareModal } from './compare.js';
import { adminModal } from './admin.js';

const BOARDS = {
  week: { label: 'Semana', value: (p) => p.week_xp, unit: 'XP' },
  total: { label: 'Total', value: (p) => p.xp, unit: 'XP' },
  streak: { label: 'Ofensiva', value: (p) => cloud.liveStreak(p), unit: '🔥' },
  speed: { label: 'Relâmpago', value: (p) => p.speed_record, unit: '⚡' },
};
let board = 'week';

export function renderFriends(view) {
  const st = cloud.cloudStatus();
  if (st === 'off') return view.append(offCard());
  if (st === 'loading') return view.append(h('div', { class: 'card center muted' }, '⏳ Conectando…'));
  if (st === 'signedOut') return view.append(welcomeCard());
  if (st === 'revoked') return view.append(revokedCard());

  const box = h('div', { class: 'friends' });
  view.append(box);
  fill(box, cloud.cachedOverview());
  if (Date.now() - (state.cloud.overviewAt || 0) > 10e3) {
    cloud.refreshOverview()
      .then((ov) => { if (box.isConnected) fill(box, ov); })
      .catch((e) => { if (box.isConnected && !cloud.cachedOverview()) box.replaceChildren(errorCard(e)); });
  }
}

function offCard() {
  return h('div', { class: 'card info' },
    h('div', { class: 'card-title' }, '👥 Modo Amigos'),
    h('p', {}, 'Compita com seus amigos num placar semanal. Este recurso ainda não foi configurado nesta instalação do app.'),
    h('p', { class: 'small' }, 'Quem administra o app precisa seguir os passos de "Modo Amigos" no README.'));
}

function welcomeCard() {
  return h('div', { class: 'card friends-hero center' },
    h('div', { class: 'hero-emoji' }, '🏆'),
    h('h2', {}, 'Compita com seus amigos'),
    h('p', { class: 'muted' }, 'Placar semanal de XP, ofensivas, recordes do Desafio relâmpago e prêmios para o pódio. O acesso é só por convite.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn green big', onClick: () => signupModal() }, '🎟️ Tenho um convite'),
      h('button', { class: 'btn ghost big', onClick: () => loginModal() }, 'Entrar')),
    h('p', { class: 'muted small' }, 'Seu progresso continua salvo neste aparelho; a conta só compartilha suas estatísticas com os amigos que você aceitar.'));
}

function revokedCard() {
  return h('div', { class: 'card info center' },
    h('div', { class: 'hero-emoji' }, '🔒'),
    h('div', { class: 'card-title' }, 'Acesso revogado'),
    h('p', {}, 'O administrador do grupo removeu seu acesso ao modo Amigos. Seu progresso local continua intacto.'),
    h('button', { class: 'btn ghost', onClick: async () => { await cloud.signOut(); rerender(); } }, 'Sair da conta'));
}

function errorCard(e) {
  return h('div', { class: 'card info center' },
    h('p', {}, cloud.errorMessage(e)),
    h('button', { class: 'btn ghost small', onClick: () => rerender() }, 'Tentar de novo'));
}

function fill(box, ov) {
  const me = cloud.myProfile() || {};
  box.replaceChildren(...[
    meCard(me),
    ov?.incoming?.length > 0 && requestsCard(ov.incoming),
    ov ? boardCard(ov) : h('div', { class: 'card center muted' }, '⏳ Carregando placar…'),
    addFriendCard(ov),
    accountFooter(),
  ].filter(Boolean));
}

function meCard(me) {
  const lv = levelInfo();
  return h('div', { class: 'card profile-head' },
    h('div', { class: 'avatar' }, me.avatar || '🐼'),
    h('div', { class: 'grow' },
      h('div', { class: 'lvl' }, me.display_name || me.username || '—', me.role === 'admin' && h('span', { class: 'pill gold' }, 'admin')),
      h('div', { class: 'muted small' }, `@${me.username || '—'} · Nível ${lv.level} · ${state.xp} XP`),
      me.friend_code && h('div', { class: 'friend-code' },
        h('span', { class: 'muted small' }, 'Seu código de amigo:'),
        h('button', {
          class: 'code-chip', title: 'Copiar ou compartilhar',
          onClick: () => share(`Meu código de amigo no Hanzi Quest: ${me.friend_code}`),
        }, me.friend_code, ' 📋'))),
    h('div', { class: 'head-actions' },
      h('button', { class: 'icon-btn', title: 'Editar perfil', 'aria-label': 'Editar perfil', onClick: () => profileModal(me) }, '✏️'),
      cloud.isAdmin() && h('button', { class: 'icon-btn', title: 'Painel do administrador', 'aria-label': 'Painel do administrador', onClick: adminModal }, '🛡️')));
}

function requestsCard(list) {
  return h('div', { class: 'card requests' },
    h('div', { class: 'card-title' }, `Pedidos de amizade · ${list.length}`),
    list.map((r) => h('div', { class: 'person-row' },
      h('span', { class: 'p-avatar' }, r.avatar),
      h('div', { class: 'grow' }, h('b', {}, r.display_name), h('div', { class: 'muted small' }, `@${r.username}`)),
      h('button', { class: 'btn green small', onClick: (e) => act(e, () => cloud.respondRequest(r.id, true), `Agora você e ${r.display_name} são amigos!`) }, 'Aceitar'),
      h('button', { class: 'btn ghost small', onClick: (e) => act(e, () => cloud.respondRequest(r.id, false)) }, 'Recusar'))));
}

function boardCard(ov) {
  const b = BOARDS[board];
  const people = [...ov.people].sort((x, y) => b.value(y) - b.value(x) || y.xp - x.xp);
  const end = addDays(ov.week_start, 7);
  const left = dayDiff(todayKey(), end);
  const ends = left <= 1 ? 'último dia!' : left === 2 ? 'termina amanhã' : `termina em ${left - 1} dias`;
  const lastWeek = ov.people.filter((p) => p.last_week_xp > 0).sort((x, y) => y.last_week_xp - x.last_week_xp)[0];
  let rank = 0, prev = null;
  return h('div', { class: 'card board' },
    h('div', { class: 'board-head' },
      h('div', { class: 'card-title' }, 'Placar'),
      h('div', { class: 'seg', role: 'tablist' }, Object.entries(BOARDS).map(([k, v]) => h('button', {
        class: `seg-btn ${k === board ? 'active' : ''}`, role: 'tab', 'aria-selected': k === board ? 'true' : 'false',
        onClick: () => { board = k; rerender(); },
      }, v.label)))),
    board === 'week' && h('div', { class: 'muted small board-sub' },
      `Semana de ${fmtDate(ov.week_start + 'T12:00')} a ${fmtDate(addDays(ov.week_start, 6) + 'T12:00')} · ${ends}`),
    h('ol', { class: 'lb' }, people.map((p, i) => {
      const v = b.value(p);
      if (v !== prev) { rank = i + 1; prev = v; }
      return h('li', {},
        h('button', { class: `lb-row ${p.is_me ? 'me' : ''}`, onClick: () => (p.is_me ? (location.hash = '#/profile') : compareModal(p)) },
          h('span', { class: 'lb-rank' }, v > 0 && rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank),
          h('span', { class: 'p-avatar' }, p.avatar),
          h('span', { class: 'grow lb-name' }, h('b', {}, p.is_me ? `${p.display_name} (você)` : p.display_name), h('small', { class: 'muted' }, `Nível ${p.level} · 🔥 ${cloud.liveStreak(p)}`)),
          h('span', { class: 'lb-val' }, v, ' ', h('small', {}, b.unit))));
    })),
    ov.people.length < 2 && h('p', { class: 'muted small center' }, 'Você ainda não tem amigos aqui. Peça o código de amigo de alguém do grupo e adicione abaixo.'),
    board === 'week' && lastWeek && ov.people.length > 1 && h('div', { class: 'muted small board-sub' },
      `Semana passada: 🥇 ${lastWeek.display_name} com ${lastWeek.last_week_xp} XP. Pódio ganha 50 / 25 / 10 💰.`),
    board === 'week' && !lastWeek && ov.people.length > 1 && h('div', { class: 'muted small board-sub' }, 'Pódio da semana ganha 50 / 25 / 10 💰.'));
}

function addFriendCard(ov) {
  const input = h('input', { class: 'field-input code-input', placeholder: 'Código de amigo (ex.: K7P2QX)', maxlength: 6, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
  const send = async (e) => {
    e.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) return toast('O código de amigo tem 6 letras e números.', { icon: '⚠️' });
    const msg = {
      requested: ['Pedido enviado! Aguarde a pessoa aceitar.', '📨'],
      accepted: ['Vocês agora são amigos!', '🤝'],
      already_friends: ['Vocês já são amigos.', '🤝'],
      already_requested: ['Você já mandou um pedido para essa pessoa.', '⏳'],
      not_found: ['Nenhum membro do grupo tem esse código.', '🤔'],
      self: ['Esse é o seu próprio código. 😄', '🙃'],
    };
    await act(e, async () => {
      const r = await cloud.sendFriendRequest(code);
      toast(msg[r]?.[0] || r, { icon: msg[r]?.[1] || '✨' });
      if (r === 'accepted') checkAchievements();
    });
  };
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, 'Adicionar amigo'),
    h('form', { class: 'inline-form', onSubmit: send }, input, h('button', { class: 'btn small', type: 'submit' }, 'Enviar')),
    ov?.outgoing?.length > 0 && h('div', { class: 'outgoing' },
      h('div', { class: 'muted small' }, 'Pedidos enviados:'),
      ov.outgoing.map((r) => h('div', { class: 'person-row' },
        h('span', { class: 'p-avatar' }, r.avatar),
        h('div', { class: 'grow' }, h('b', {}, r.display_name), h('span', { class: 'muted small' }, ` @${r.username} · aguardando`)),
        h('button', { class: 'btn ghost small', onClick: (e) => act(e, () => cloud.removeFriend(r.user_id), 'Pedido cancelado.') }, 'Cancelar')))));
}

function accountFooter() {
  const c = state.cloud;
  return h('div', { class: 'account-foot muted small' },
    h('span', {}, c.dirty ? '⏳ Progresso aguardando conexão para ser enviado' : c.lastSync ? `✅ Progresso enviado ${ago(c.lastSync)}` : ''),
    cloud.isMock && h('span', { class: 'pill' }, 'servidor simulado'),
    h('button', { class: 'link-btn', onClick: async () => {
      const ok = await modal({ title: 'Sair da conta?', body: 'Seu progresso continua salvo neste aparelho. Para voltar, entre com seu usuário e senha.', actions: [{ label: 'Cancelar', value: false, class: 'ghost' }, { label: 'Sair', value: true, class: 'danger' }] });
      if (ok) { await cloud.signOut(); rerender(); }
    } }, 'Sair da conta'));
}

/** Executa uma ação de botão com estado "ocupado", mensagem de sucesso e re-renderização. */
