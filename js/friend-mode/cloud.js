// Modo Amigos: conta (convite + usuário + senha), sincronização do progresso e chamadas ao servidor (Supabase).
// Todo o acesso ao banco passa pelas funções de supabase/schema.sql.
import { state, save } from '../state.js';
import { bus } from '../lib/events.js';
import { todayKey, addDays } from '../lib/time.js';
import { mastery } from '../srs.js';
import { addCoins } from '../game.js';
import { SUPABASE_URL, SUPABASE_KEY, USER_EMAIL_DOMAIN, SUPABASE_JS } from './config.js';

// ---------- modo de teste local (?mock em localhost): servidor simulado no navegador ----------
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
let mock = false;
try {
  if (LOCAL && new URLSearchParams(location.search).has('mock')) sessionStorage.setItem('hq:mock', '1');
  mock = LOCAL && sessionStorage.getItem('hq:mock') === '1';
} catch { /* sessionStorage indisponível */ }

export const cloudEnabled = mock || !!(SUPABASE_URL && SUPABASE_KEY);
export const isMock = mock;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;

let apiPromise = null;
function api() {
  apiPromise ??= mock ? import('./mock.js').then((m) => m.createMockApi()) : supabaseApi();
  return apiPromise;
}

async function supabaseApi() {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hanziquest:auth' },
  });
  const email = (u) => `${u}@${USER_EMAIL_DOMAIN}`;
  return {
    async session() {
      const { data } = await sb.auth.getSession();
      return data.session?.user?.id || null;
    },
    async signUp(username, password, meta) {
      const { data, error } = await sb.auth.signUp({ email: email(username), password, options: { data: meta } });
      if (error) throw error;
      if (!data.session) throw new Error('HQ_CONFIRM_ON');
      return data.user.id;
    },
    async signIn(username, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email(username), password });
      if (error) throw error;
      return data.user.id;
    },
    async signOut() { await sb.auth.signOut(); },
    async rpc(fn, args = {}) {
      const { data, error } = await sb.rpc(fn, args);
      if (error) throw error;
      return data;
    },
  };
}

// ---------- mensagens ----------
export const INVITE_MSG = {
  invalid: 'Convite inválido. Confira o código.',
  used: 'Esse convite já foi usado.',
  expired: 'Esse convite expirou. Peça um novo.',
  full: 'O grupo está cheio: o limite de membros foi atingido.',
  username_invalid: 'Nome de usuário: 3 a 20 caracteres, só letras minúsculas, números ou _.',
  username_taken: 'Esse nome de usuário já existe. Escolha outro.',
};

export function errorMessage(e) {
  const m = `${e?.message || ''} ${e?.code || ''} ${e || ''}`;
  if (/HQ_INVITE_(\w+)/.test(m)) return INVITE_MSG[m.match(/HQ_INVITE_(\w+)/)[1].toLowerCase()] || INVITE_MSG.invalid;
  if (/HQ_FULL/.test(m)) return INVITE_MSG.full;
  if (/HQ_FORBIDDEN|42501/.test(m)) return 'Sem permissão. Seu acesso pode ter sido revogado.';
  if (/HQ_SELF/.test(m)) return 'Você não pode fazer isso com a sua própria conta.';
  if (/HQ_CONFIRM_ON/.test(m)) return 'O servidor ainda exige confirmação de e-mail. O administrador precisa desativar "Confirm email" no Supabase.';
  if (/invalid login credentials/i.test(m)) return 'Usuário ou senha incorretos.';
  if (/already registered|already exists/i.test(m)) return INVITE_MSG.username_taken;
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return `Senha fraca: use pelo menos ${PASSWORD_MIN} caracteres.`;
  if (/database error saving new user/i.test(m)) return 'Não foi possível criar a conta. Confira o convite e tente de novo.';
  if (/failed to fetch|networkerror|network|load failed|importing a module/i.test(m) || !navigator.onLine) {
    return 'Sem conexão com o servidor. Tente de novo quando estiver online.';
  }
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere alguns minutos.';
  return 'Algo deu errado. Tente de novo.';
}

// ---------- estado da conta ----------
// status: off | loading | signedOut | revoked | member
let status = cloudEnabled ? 'loading' : 'off';
let profile = null;
export const cloudStatus = () => status;
export const myProfile = () => profile;
export const isAdmin = () => status === 'member' && profile?.role === 'admin';
const c = () => state.cloud;

function setStatus(s) {
  status = s;
  bus.emit('cloud', s);
}

async function loadProfile() {
  const a = await api();
  const uid = await a.session();
  if (!uid) { profile = null; setStatus('signedOut'); return; }
  profile = await a.rpc('me');
  if (!profile) { setStatus('signedOut'); return; }
  c().username = profile.username;
  save();
  setStatus(profile.status === 'active' ? 'member' : 'revoked');
}

/** Convite vindo de um link ?invite=CODIGO (lido uma vez e removido da barra de endereço). */
let linkInvite = null;
export function takeLinkInvite() {
  const v = linkInvite;
  linkInvite = null;
  return v;
}

export async function initCloud() {
  if (!cloudEnabled) return;
  const params = new URLSearchParams(location.search);
  if (params.get('invite')) {
    linkInvite = params.get('invite').toUpperCase();
    params.delete('invite');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }
  bus.on('change', markDirty);
  window.addEventListener('online', async () => {
    if (profile?.offline) await afterLogin().catch(() => {});
    else if (c().dirty) syncSoon(500);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && c().dirty) syncNow(); });
  try {
    await loadProfile();
  } catch {
    // sem rede: usa o que estava em cache e tenta de novo depois
    setStatus(c().username ? 'member' : 'signedOut');
    if (c().username) profile = { username: c().username, ...(c().profile || {}), offline: true };
    return;
  }
  if (status === 'member') {
    c().profile = { display_name: profile.display_name, avatar: profile.avatar, role: profile.role, friend_code: profile.friend_code };
    save();
    await syncNow();
    refreshOverview().catch(() => {});
  }
}

// ---------- autenticação ----------
export async function checkInvite(code, username) {
  const a = await api();
  return a.rpc('check_invite', { p_code: code.trim().toUpperCase(), p_username: username ?? null });
}

export async function signUp({ invite, username, password, displayName, avatar }) {
  const a = await api();
  const st = await checkInvite(invite, username);
  if (st !== 'ok') throw new Error(`HQ_INVITE_${st.toUpperCase()}`);
  await a.signUp(username, password, { invite: invite.trim().toUpperCase(), username, display_name: displayName, avatar });
  await afterLogin();
}

export async function signIn(username, password) {
  const a = await api();
  await a.signIn(username.trim().toLowerCase(), password);
  await afterLogin();
}

async function afterLogin() {
  await loadProfile();
  if (status === 'member') {
    c().profile = { display_name: profile.display_name, avatar: profile.avatar, role: profile.role, friend_code: profile.friend_code };
    c().dirty = true;
    save();
    await syncNow();
    await refreshOverview().catch(() => {});
  }
}

export async function signOut() {
  const a = await api();
  await a.signOut().catch(() => {});
  profile = null;
  // mantém o progresso local; esquece só o que veio do servidor
  state.cloud = { ...state.cloud, username: null, profile: null, overview: null, seen: null, dirty: false };
  save();
  setStatus('signedOut');
}

export async function updateProfile(displayName, avatar) {
  const a = await api();
  await a.rpc('update_profile', { p_display_name: displayName, p_avatar: avatar });
  await loadProfile();
  c().profile = { ...(c().profile || {}), display_name: profile.display_name, avatar: profile.avatar };
  save();
}

// ---------- sincronização do progresso ----------
function markDirty() {
  if (status !== 'member') return;
  if (!c().dirty) { c().dirty = true; save(); }
  syncSoon();
}

let timer = null;
function syncSoon(ms = 4000) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

/** Retrato do progresso local enviado ao servidor (o servidor aplica os limites). */
export function snapshot() {
  const t = todayKey();
  const alive = state.lastDay === t || state.lastDay === addDays(t, -1);
  const ids = Object.keys(state.srs);
  const answered = state.stats.correct + state.stats.wrong;
  const days = {};
  for (let i = 0; i < 84; i++) {
    const k = addDays(t, -i);
    if (state.days[k]) days[k] = state.days[k];
  }
  return {
    xp: state.xp,
    streak: alive ? state.streak : 0,
    best_streak: state.bestStreak,
    last_day: state.lastDay,
    words_learned: ids.length,
    words_mastered: ids.filter((id) => mastery(id) === 5).length,
    lessons: state.stats.lessons,
    speed_record: state.stats.bestSpeed,
    accuracy: answered ? Math.round((state.stats.correct / answered) * 100) : 0,
    minutes: state.stats.minutes,
    days,
  };
}

let syncing = null;
export async function syncNow() {
  if (status !== 'member' || profile?.offline) return;
  clearTimeout(timer);
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const a = await api();
      await a.rpc('report_progress', { p: snapshot() });
      c().dirty = false;
      c().lastSync = Date.now();
      save();
    } catch (e) {
      c().dirty = true;
      save();
      if (/HQ_FORBIDDEN|42501/.test(`${e?.message} ${e?.code}`)) await loadProfile().catch(() => {});
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

// ---------- placar e amigos ----------
/** Segunda-feira (local) da semana de `key`. */
export function weekStart(key = todayKey()) {
  const dow = (new Date(key + 'T12:00').getDay() + 6) % 7;
  return addDays(key, -dow);
}

export const cachedOverview = () => c().overview;
export const incomingCount = () => c().overview?.incoming?.length || 0;

/** Ofensiva que ainda vale hoje (quem não pratica desde anteontem está com 0). */
export function liveStreak(p) {
  return p.last_day && p.last_day >= addDays(todayKey(), -1) ? p.streak : 0;
}

export async function refreshOverview() {
  if (status !== 'member') return null;
  const a = await api();
  const ov = await a.rpc('friends_overview', { p_week_start: weekStart() });
  processOverview(ov);
  c().overview = ov;
  c().overviewAt = Date.now();
  save();
  bus.emit('overview', ov);
  return ov;
}

const PRIZES = [50, 25, 10];

function processOverview(ov) {
  const me = ov.people.find((p) => p.is_me);
  const others = ov.people.filter((p) => !p.is_me);
  c().friends = others.length;

  // prêmio da semana anterior (uma vez por semana, com pelo menos 2 participantes)
  if (c().rewardedWeek !== ov.week_start) {
    c().rewardedWeek = ov.week_start;
    const ranked = ov.people.filter((p) => p.last_week_xp > 0).sort((a, b) => b.last_week_xp - a.last_week_xp);
    const pos = ranked.findIndex((p) => p.is_me);
    if (ranked.length >= 2 && pos >= 0 && pos < PRIZES.length && (pos < 2 || ranked.length >= 3)) {
      if (pos === 0) c().weeklyWins = (c().weeklyWins || 0) + 1;
      addCoins(PRIZES[pos]);
      bus.emit('weeklyPrize', { pos, prize: PRIZES[pos], xp: me.last_week_xp });
    }
  }

  // recorde do Desafio relâmpago mais alto da turma
  c().speedTop = !!me && others.length > 0 && others.every((p) => me.speed_record > p.speed_record);

  // alguém passou você no placar da semana desde a última vez?
  const prev = c().seen;
  if (me && prev?.week === ov.week_start) {
    for (const p of others) {
      if ((prev.xp[p.user_id] ?? 0) <= prev.me && p.week_xp > me.week_xp) bus.emit('overtaken', p);
    }
  }
  if (me) c().seen = { week: ov.week_start, me: me.week_xp, xp: Object.fromEntries(others.map((p) => [p.user_id, p.week_xp])) };
  save();
}

/** Para o Desafio relâmpago: o melhor recorde entre os amigos (do cache). */
export function speedRival() {
  const others = (c().overview?.people || []).filter((p) => !p.is_me && p.speed_record > 0);
  if (!others.length) return null;
  return others.reduce((a, b) => (b.speed_record > a.speed_record ? b : a));
}

const call = async (fn, args) => (await api()).rpc(fn, args);
export const friendDetail = (userId) => call('friend_detail', { p_user: userId });
export async function sendFriendRequest(code) {
  const r = await call('send_friend_request', { p_friend_code: code.trim().toUpperCase() });
  await refreshOverview().catch(() => {});
  return r;
}
export async function respondRequest(id, accept) {
  await call('respond_friend_request', { p_id: id, p_accept: accept });
  await refreshOverview().catch(() => {});
}
export async function removeFriend(userId) {
  await call('remove_friend', { p_user: userId });
  await refreshOverview().catch(() => {});
}

// ---------- administrador ----------
export const adminOverview = () => call('admin_overview');
export const createInvite = (note, days) => call('admin_create_invite', { p_note: note || null, p_days: days });
export const deleteInvite = (code) => call('admin_delete_invite', { p_code: code });
export const setMemberStatus = (userId, st) => call('admin_set_member_status', { p_user: userId, p_status: st });
export const setMemberCap = (cap) => call('admin_set_cap', { p_cap: cap });

export function inviteLink(code) {
  return `${location.origin}${location.pathname}?invite=${encodeURIComponent(code)}`;
}
