// Tela "Amigos": conta (convite + usuário + senha), placar com os amigos, pedidos de amizade,
// comparação "você × amigo" e painel do administrador (convites e membros).
import { h, todayKey, addDays, dayDiff } from './util.js';
import { state } from './state.js';
import { levelInfo, checkAchievements } from './game.js';
import { modal, toast, confetti, heatmap } from './ui.js';
import * as cloud from './cloud.js';

const AVATARS = ['🐼', '🐉', '🦊', '🐯', '🐱', '🐶', '🐸', '🐵', '🦁', '🐨', '🐰', '🦄', '🐧', '🐢', '🐙', '🌸'];
const BOARDS = {
  week: { label: 'Semana', value: (p) => p.week_xp, unit: 'XP' },
  total: { label: 'Total', value: (p) => p.xp, unit: 'XP' },
  streak: { label: 'Ofensiva', value: (p) => cloud.liveStreak(p), unit: '🔥' },
  speed: { label: 'Relâmpago', value: (p) => p.speed_record, unit: '⚡' },
};
let board = 'week';
let rerender = () => {};
export function setSocialRerender(fn) { rerender = fn; }

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '—');
const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 6e4);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`;
};

// ---------------------------------------------------------------- tela
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
async function act(e, fn, okMsg) {
  const btn = e?.currentTarget || e?.target?.querySelector?.('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await fn();
    if (okMsg) toast(okMsg, { icon: '✅' });
    rerender();
  } catch (err) {
    toast(cloud.errorMessage(err), { icon: '⚠️', ms: 5000 });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function share(text, url) {
  const full = url ? `${text}\n${url}` : text;
  if (navigator.share) {
    try { await navigator.share(url ? { text, url } : { text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(full);
    toast('Copiado! Agora é só colar na conversa.', { icon: '📋' });
  } catch {
    modal({ title: 'Copie e envie', body: h('textarea', { class: 'field-input share-box', readonly: true, rows: 4 }, full) });
  }
}

// ---------------------------------------------------------------- formulários
function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint && h('span', { class: 'field-hint muted small' }, hint));
}

function avatarPicker(current) {
  let value = current || AVATARS[0];
  const el = h('div', { class: 'avatar-pick', role: 'radiogroup', 'aria-label': 'Avatar' }, AVATARS.map((a) => h('button', {
    type: 'button', class: `av ${a === value ? 'active' : ''}`, role: 'radio', 'aria-checked': a === value ? 'true' : 'false',
    onClick: (e) => {
      value = a;
      el.querySelectorAll('.av').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-checked', 'true');
    },
  }, a)));
  el.value = () => value;
  return el;
}

/** Modal com formulário que só fecha quando `onSubmit` dá certo. */
function formModal({ title, fields, submitLabel, onSubmit, extra }) {
  const err = h('div', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn green big', type: 'submit' }, submitLabel);
  const form = h('form', { class: 'form', novalidate: true }, fields, err, submit, extra);
  const p = modal({ title, body: form, actions: [] });
  const close = () => form.closest('.modal-wrap')?._close(true);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = '⏳';
    try {
      const msg = await onSubmit();
      if (typeof msg === 'string') err.textContent = msg;
      else close();
    } catch (ex) {
      err.textContent = cloud.errorMessage(ex);
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
  setTimeout(() => form.querySelector('input:not([value]), input')?.focus(), 250);
  return { promise: p, close };
}

export function signupModal(invite = '') {
  const inv = h('input', { class: 'field-input code-input', name: 'invite', value: invite, placeholder: 'HQ-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const user = h('input', { class: 'field-input', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 20, placeholder: 'ex.: victor_p' });
  const name = h('input', { class: 'field-input', name: 'nickname', autocomplete: 'nickname', maxlength: 24, placeholder: 'Como seus amigos vão te ver' });
  const pass = h('input', { class: 'field-input', type: 'password', name: 'password', autocomplete: 'new-password', minlength: cloud.PASSWORD_MIN });
  const pass2 = h('input', { class: 'field-input', type: 'password', name: 'password2', autocomplete: 'new-password' });
  const av = avatarPicker('🐼');
  user.addEventListener('input', () => { user.value = user.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
  inv.addEventListener('change', async () => {
    if (!inv.value.trim()) return;
    try {
      const st = await cloud.checkInvite(inv.value);
      inv.setCustomValidity(st === 'ok' ? '' : 'x');
      inv.classList.toggle('bad', st !== 'ok');
      inv.closest('.field').querySelector('.field-hint').textContent = st === 'ok' ? '✅ Convite válido' : cloud.INVITE_MSG[st] || '';
    } catch { /* checa de novo no envio */ }
  });
  const m = formModal({
    title: '🎟️ Criar conta',
    fields: [
      field('Código do convite', inv, ' '),
      field('Nome de usuário', user, 'Para entrar. 3 a 20 letras minúsculas, números ou _.'),
      field('Nome de exibição', name),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Avatar'), av),
      field('Senha', pass, `Pelo menos ${cloud.PASSWORD_MIN} caracteres. Não há recuperação por e-mail: guarde-a bem.`),
      field('Confirmar senha', pass2),
    ],
    submitLabel: 'Criar conta',
    extra: h('button', { type: 'button', class: 'link-btn', onClick: () => { m.close(); loginModal(); } }, 'Já tenho conta → Entrar'),
    async onSubmit() {
      if (!inv.value.trim()) return 'Informe o código do convite.';
      if (!cloud.USERNAME_RE.test(user.value)) return cloud.INVITE_MSG.username_invalid;
      if (pass.value.length < cloud.PASSWORD_MIN) return `A senha precisa ter pelo menos ${cloud.PASSWORD_MIN} caracteres.`;
      if (pass.value !== pass2.value) return 'As senhas não conferem.';
      await cloud.signUp({ invite: inv.value, username: user.value, password: pass.value, displayName: name.value.trim() || user.value, avatar: av.value() });
      confetti(120);
      toast(`<b>Bem-vindo à turma!</b><br>Seu progresso já aparece no placar.`, { icon: '🎉', kind: 'green', ms: 4500 });
      checkAchievements();
      location.hash = '#/friends';
      rerender();
    },
  });
  return m.promise;
}

export function loginModal() {
  const user = h('input', { class: 'field-input', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
  const pass = h('input', { class: 'field-input', type: 'password', name: 'password', autocomplete: 'current-password' });
  const m = formModal({
    title: 'Entrar',
    fields: [field('Nome de usuário', user), field('Senha', pass, 'Esqueceu a senha? Peça ao administrador do grupo para redefini-la.')],
    submitLabel: 'Entrar',
    extra: h('button', { type: 'button', class: 'link-btn', onClick: () => { m.close(); signupModal(); } }, 'Tenho um convite → Criar conta'),
    async onSubmit() {
      if (!user.value.trim() || !pass.value) return 'Preencha usuário e senha.';
      await cloud.signIn(user.value, pass.value);
      if (cloud.cloudStatus() === 'revoked') return 'O acesso desta conta foi revogado pelo administrador.';
      toast(`Olá de novo, ${cloud.myProfile()?.display_name || ''}!`, { icon: '👋' });
      checkAchievements();
      rerender();
    },
  });
  return m.promise;
}

function profileModal(me) {
  const name = h('input', { class: 'field-input', value: me.display_name || '', maxlength: 24 });
  const av = avatarPicker(me.avatar);
  formModal({
    title: '✏️ Editar perfil',
    fields: [field('Nome de exibição', name), h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Avatar'), av)],
    submitLabel: 'Salvar',
    async onSubmit() {
      if (!name.value.trim()) return 'Escolha um nome de exibição.';
      await cloud.updateProfile(name.value.trim(), av.value());
      rerender();
    },
  });
}

// ---------------------------------------------------------------- você × amigo
function compareModal(p) {
  const body = h('div', { class: 'compare' }, h('p', { class: 'center muted' }, '⏳ Carregando…'));
  const actions = [{ label: 'Fechar', value: null, class: 'ghost' }, { label: 'Desfazer amizade', value: 'remove', class: 'danger' }];
  modal({ title: `Você × ${p.display_name}`, body, actions, className: 'compare-modal' }).then(async (v) => {
    if (v !== 'remove') return;
    const ok = await modal({ title: `Desfazer amizade com ${p.display_name}?`, body: 'Vocês deixam de ver as estatísticas um do outro. Dá para adicionar de novo pelo código de amigo.', actions: [{ label: 'Cancelar', value: false, class: 'ghost' }, { label: 'Desfazer', value: true, class: 'danger' }] });
    if (ok) act(null, () => cloud.removeFriend(p.user_id), 'Amizade desfeita.');
  });
  cloud.friendDetail(p.user_id).then((d) => {
    const mine = cloud.snapshot();
    const meOv = cloud.cachedOverview()?.people.find((x) => x.is_me);
    const s = d.stats;
    const rows = [
      ['Nível', levelInfo().level, s.level],
      ['XP total', state.xp, s.xp],
      ['XP na semana', meOv?.week_xp ?? 0, p.week_xp],
      ['Ofensiva atual', mine.streak, cloud.liveStreak(s)],
      ['Melhor ofensiva', mine.best_streak, s.best_streak],
      ['Palavras aprendidas', mine.words_learned, s.words_learned],
      ['Palavras dominadas', mine.words_mastered, s.words_mastered],
      ['Lições', mine.lessons, s.lessons],
      ['Recorde relâmpago', mine.speed_record, s.speed_record],
      ['Precisão', `${mine.accuracy}%`, `${s.accuracy}%`],
      ['Tempo de estudo', `${mine.minutes}m`, `${s.minutes}m`],
    ];
    const num = (v) => parseFloat(v) || 0;
    body.replaceChildren(
      h('div', { class: 'cmp-head' },
        h('div', {}, h('span', { class: 'p-avatar big' }, cloud.myProfile()?.avatar || '🐼'), h('b', {}, 'Você')),
        h('div', { class: 'cmp-vs' }, 'VS'),
        h('div', {}, h('span', { class: 'p-avatar big' }, d.avatar), h('b', {}, d.display_name))),
      h('table', { class: 'cmp-table' }, h('tbody', {}, rows.map(([label, a, b]) => h('tr', {},
        h('td', { class: num(a) > num(b) ? 'win' : '' }, a),
        h('th', { scope: 'row' }, label),
        h('td', { class: num(b) > num(a) ? 'win' : '' }, b))))),
      h('div', { class: 'cmp-maps' },
        h('div', {}, h('div', { class: 'muted small' }, 'Sua atividade'), heatmap(state.days, 12)),
        h('div', {}, h('div', { class: 'muted small' }, `Atividade de ${d.display_name}`), heatmap(d.days || {}, 12))),
      h('p', { class: 'muted small center' }, `Membro desde ${fmtDate(d.joined_at)}${s.reported_at ? ` · atualizado ${ago(new Date(s.reported_at).getTime())}` : ''}`));
  }).catch((e) => body.replaceChildren(h('p', { class: 'center' }, cloud.errorMessage(e))));
}

// ---------------------------------------------------------------- administrador
function adminModal() {
  const body = h('div', { class: 'admin' }, h('p', { class: 'center muted' }, '⏳ Carregando…'));
  modal({ title: '🛡️ Painel do administrador', body, actions: [{ label: 'Fechar', value: true, class: 'ghost' }], className: 'admin-modal' });
  const reload = () => cloud.adminOverview().then((d) => drawAdmin(body, d, reload)).catch((e) => body.replaceChildren(h('p', {}, cloud.errorMessage(e))));
  reload();
}

function drawAdmin(body, d, reload) {
  const run = async (e, fn, okMsg) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { await fn(); if (okMsg) toast(okMsg, { icon: '✅' }); await reload(); } catch (err) { toast(cloud.errorMessage(err), { icon: '⚠️', ms: 5000 }); btn.disabled = false; }
  };
  const meId = cloud.myProfile()?.user_id;
  const free = Math.max(0, d.member_cap - d.active);
  const pending = d.invites.filter((i) => !i.used_at && !i.grants_admin);
  const now = Date.now();

  const note = h('input', { class: 'field-input', placeholder: 'Para quem? (opcional)', maxlength: 60 });
  const days = h('select', {}, [[1, '1 dia'], [3, '3 dias'], [7, '7 dias'], [14, '14 dias'], [30, '30 dias']].map(([v, l]) => h('option', { value: v, selected: v === 7 }, l)));
  const cap = h('input', { class: 'field-input cap-input', type: 'number', min: 1, max: 100, value: d.member_cap });

  body.replaceChildren(
    h('section', {},
      h('h3', {}, `Membros · ${d.active}/${d.member_cap}`),
      h('p', { class: 'muted small' }, free > 0 ? `${free} vaga${free > 1 ? 's' : ''} livre${free > 1 ? 's' : ''}. O limite conta todos os membros ativos, incluindo você.` : 'Grupo cheio: novos convites só funcionam se você liberar vagas ou aumentar o limite.'),
      d.members.map((m) => h('div', { class: `person-row ${m.status === 'revoked' ? 'revoked' : ''}` },
        h('span', { class: 'p-avatar' }, m.avatar),
        h('div', { class: 'grow' },
          h('b', {}, m.display_name, ' '), h('span', { class: 'muted small' }, `@${m.username}`),
          m.role === 'admin' && h('span', { class: 'pill gold' }, 'admin'),
          m.status === 'revoked' && h('span', { class: 'pill red' }, 'revogado'),
          h('div', { class: 'muted small' }, `Entrou em ${fmtDate(m.joined_at)} · ${m.xp ?? 0} XP${m.reported_at ? ` · ativo ${ago(new Date(m.reported_at).getTime())}` : ''}`)),
        m.user_id !== meId && (m.status === 'active'
          ? h('button', { class: 'btn danger small', onClick: (e) => run(e, () => cloud.setMemberStatus(m.user_id, 'revoked'), `Acesso de @${m.username} revogado.`) }, 'Revogar')
          : h('button', { class: 'btn ghost small', onClick: (e) => run(e, () => cloud.setMemberStatus(m.user_id, 'active'), `@${m.username} reativado.`) }, 'Reativar')))),
      h('form', { class: 'inline-form', onSubmit: (e) => { e.preventDefault(); run({ currentTarget: e.target.querySelector('button') }, () => cloud.setMemberCap(+cap.value), 'Limite atualizado.'); } },
        h('span', { class: 'field-label' }, 'Limite de membros'), cap, h('button', { class: 'btn ghost small', type: 'submit' }, 'Salvar')),
      h('p', { class: 'muted small' }, 'Revogar bloqueia o acesso na hora e libera a vaga. Para apagar a conta de vez ou redefinir uma senha: Supabase → Authentication → Users.')),
    h('section', {},
      h('h3', {}, 'Convites'),
      h('form', { class: 'inline-form wrap', onSubmit: (e) => {
        e.preventDefault();
        run({ currentTarget: e.target.querySelector('button') }, async () => {
          const code = await cloud.createInvite(note.value.trim(), +days.value);
          share(`Convite para o Hanzi Quest 汉字之旅 (uso único): ${code}`, cloud.inviteLink(code));
        }, 'Convite criado.');
      } }, note, days, h('button', { class: 'btn green small', type: 'submit' }, '🎟️ Gerar convite')),
      h('p', { class: 'muted small' }, 'Cada convite vale para uma pessoa. Quem entrar pelo seu convite já vira seu amigo.'),
      pending.length === 0 && h('p', { class: 'muted small' }, 'Nenhum convite pendente.'),
      pending.map((i) => {
        const expired = i.expires_at && new Date(i.expires_at).getTime() < now;
        return h('div', { class: `person-row ${expired ? 'revoked' : ''}` },
          h('div', { class: 'grow' },
            h('code', { class: 'code-chip static' }, i.code), ' ', i.note && h('span', {}, i.note),
            h('div', { class: 'muted small' }, expired ? 'Expirado' : `Válido até ${fmtDate(i.expires_at)}`)),
          !expired && h('button', { class: 'btn ghost small', onClick: () => share(`Convite para o Hanzi Quest 汉字之旅 (uso único): ${i.code}`, cloud.inviteLink(i.code)) }, 'Enviar'),
          h('button', { class: 'btn danger small', 'aria-label': `Apagar convite ${i.code}`, onClick: (e) => run(e, () => cloud.deleteInvite(i.code), 'Convite apagado.') }, '🗑️'));
      }),
      d.invites.some((i) => i.used_at) && h('details', { class: 'used-invites' },
        h('summary', { class: 'muted small' }, 'Convites usados'),
        d.invites.filter((i) => i.used_at).map((i) => h('div', { class: 'muted small' }, `${i.code} → @${i.used_by || '(conta apagada)'} em ${fmtDate(i.used_at)}${i.note ? ` · ${i.note}` : ''}`)))));
}
