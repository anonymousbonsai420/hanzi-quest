// Servidor SIMULADO do modo Amigos, só para testes locais: abra http://localhost:5173/?mock
// Imita as funções de supabase/schema.sql (de forma simplificada) guardando tudo no localStorage.
// Convite de administrador de teste: HQ-TEST-ADMN. Os membros "ana" e "bruno" são fictícios.
// Nunca é carregado fora de localhost.

const KEY = 'hanziquest:mockdb';
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (k, n) => { const d = new Date(k + 'T12:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const code = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const forbidden = () => Object.assign(new Error('HQ_FORBIDDEN'), { code: '42501' });

function fakeDays(seed, avg) {
  const out = {};
  for (let i = 0; i < 84; i++) {
    const v = Math.round(((Math.sin(seed * 7 + i * 1.3) + 1) / 2) * avg * 2 * (i % 6 === 5 ? 0 : 1));
    if (v > 0) out[addDays(today(), -i)] = v;
  }
  return out;
}

function seed() {
  const now = new Date().toISOString();
  const db = {
    session: null, cap: 5, seq: 1,
    users: {
      'u-ana': { password: '-', username: 'ana', display_name: 'Ana', avatar: '🦊', role: 'member', status: 'active', friend_code: 'ANA234', invited_by: null, invite_code: 'HQ-SEED-0001', joined_at: now },
      'u-bruno': { password: '-', username: 'bruno', display_name: 'Bruno', avatar: '🐯', role: 'member', status: 'active', friend_code: 'BRU567', invited_by: null, invite_code: 'HQ-SEED-0002', joined_at: now },
    },
    stats: {
      'u-ana': { xp: 1240, streak: 6, best_streak: 11, last_day: today(), words_learned: 48, words_mastered: 12, lessons: 21, speed_record: 19, accuracy: 88, minutes: 210, reported_at: now },
      'u-bruno': { xp: 610, streak: 2, best_streak: 4, last_day: addDays(today(), -3), words_learned: 30, words_mastered: 4, lessons: 11, speed_record: 24, accuracy: 79, minutes: 95, reported_at: now },
    },
    days: { 'u-ana': fakeDays(1, 35), 'u-bruno': fakeDays(2, 20) },
    invites: {
      'HQ-TEST-ADMN': { note: 'Conta de administrador', grants_admin: true, created_by: null, created_at: now, expires_at: addDays(today(), 7) + 'T23:59:59Z', used_at: null, used_by: null },
      'HQ-SEED-0001': { note: 'Ana', grants_admin: false, created_by: null, created_at: now, expires_at: null, used_at: now, used_by: 'u-ana' },
      'HQ-SEED-0002': { note: 'Bruno', grants_admin: false, created_by: null, created_at: now, expires_at: null, used_at: now, used_by: 'u-bruno' },
    },
    friendships: [],
  };
  return db;
}

export function createMockApi() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  persist();

  const lv = (xp) => Math.floor((1 + Math.sqrt(1 + (4 * xp) / 25)) / 2);
  const active = () => Object.entries(db.users).filter(([, u]) => u.status === 'active');
  const uid = () => db.session;
  const isMember = (id = uid()) => db.users[id]?.status === 'active';
  const isAdmin = () => isMember() && db.users[uid()].role === 'admin';
  const friends = (a, b) => db.friendships.some((f) => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const pair = (a, b) => db.friendships.find((f) => (f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a));
  const sumDays = (id, from, to) => Object.entries(db.days[id] || {}).reduce((s, [k, v]) => (k >= from && k < to ? s + v : s), 0);
  const inviteState = (c) => {
    const inv = db.invites[(c || '').trim().toUpperCase()];
    if (!inv) return 'invalid';
    if (inv.used_at) return 'used';
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return 'expired';
    if (inv.grants_admin && Object.values(db.users).some((u) => u.role === 'admin')) return 'invalid';
    if (active().length >= db.cap) return 'full';
    return 'ok';
  };
  const brief = (id) => ({ username: db.users[id].username, display_name: db.users[id].display_name, avatar: db.users[id].avatar });

  const rpcs = {
    check_invite({ p_code, p_username }) {
      const s = inviteState(p_code);
      if (s !== 'ok' || p_username == null) return s;
      if (!/^[a-z0-9_]{3,20}$/.test(p_username)) return 'username_invalid';
      if (Object.values(db.users).some((u) => u.username === p_username)) return 'username_taken';
      return 'ok';
    },
    me() {
      const u = db.users[uid()];
      return u ? { user_id: uid(), ...u, password: undefined, reported_at: db.stats[uid()]?.reported_at } : null;
    },
    update_profile({ p_display_name, p_avatar }) {
      if (!isMember()) throw forbidden();
      const u = db.users[uid()];
      if (p_display_name?.trim()) u.display_name = p_display_name.trim().slice(0, 24);
      if (p_avatar?.trim()) u.avatar = p_avatar.trim();
    },
    report_progress({ p }) {
      if (!isMember()) throw forbidden();
      const s = db.stats[uid()];
      const max = s.reported_at ? s.xp + 1500 * 2 : 100000;
      s.xp = Math.max(s.xp, Math.min(p.xp || 0, max));
      Object.assign(s, {
        level: lv(s.xp), streak: p.streak, best_streak: Math.max(s.best_streak, p.best_streak), last_day: p.last_day,
        words_learned: p.words_learned, words_mastered: p.words_mastered, lessons: Math.max(s.lessons, p.lessons),
        speed_record: Math.max(s.speed_record, p.speed_record), accuracy: p.accuracy, minutes: Math.max(s.minutes, p.minutes),
        reported_at: new Date().toISOString(),
      });
      const d = (db.days[uid()] ||= {});
      for (const [k, v] of Object.entries(p.days || {})) d[k] = Math.max(d[k] || 0, Math.min(v, 1500));
      return { xp: s.xp };
    },
    friends_overview({ p_week_start: ws }) {
      if (!isMember()) throw forbidden();
      const me = uid();
      const people = active()
        .filter(([id]) => id === me || friends(me, id))
        .map(([id, u]) => ({
          user_id: id, username: u.username, display_name: u.display_name, avatar: u.avatar, is_me: id === me,
          ...db.stats[id], level: lv(db.stats[id].xp),
          week_xp: sumDays(id, ws, addDays(ws, 7)), last_week_xp: sumDays(id, addDays(ws, -7), ws),
        }))
        .sort((a, b) => b.week_xp - a.week_xp || b.xp - a.xp);
      const pending = (dir) => db.friendships
        .filter((f) => f.status === 'pending' && f[dir === 'in' ? 'addressee' : 'requester'] === me && isMember(f[dir === 'in' ? 'requester' : 'addressee']))
        .map((f) => { const other = f[dir === 'in' ? 'requester' : 'addressee']; return { id: f.id, user_id: other, ...brief(other), created_at: f.created_at }; });
      return { week_start: ws, people, incoming: pending('in'), outgoing: pending('out') };
    },
    friend_detail({ p_user }) {
      if (!isMember()) throw forbidden();
      if (p_user !== uid() && !friends(uid(), p_user)) throw forbidden();
      const u = db.users[p_user];
      return { user_id: p_user, ...brief(p_user), joined_at: u.joined_at, stats: { ...db.stats[p_user], level: lv(db.stats[p_user].xp) }, days: db.days[p_user] || {} };
    },
    send_friend_request({ p_friend_code }) {
      if (!isMember()) throw forbidden();
      const other = active().find(([, u]) => u.friend_code === p_friend_code.trim().toUpperCase())?.[0];
      if (!other) return 'not_found';
      if (other === uid()) return 'self';
      const f = pair(uid(), other);
      if (f) {
        if (f.status === 'accepted') return 'already_friends';
        if (f.requester === uid()) return 'already_requested';
        f.status = 'accepted';
        return 'accepted';
      }
      db.friendships.push({ id: db.seq++, requester: uid(), addressee: other, status: 'pending', created_at: new Date().toISOString() });
      return 'requested';
    },
    respond_friend_request({ p_id, p_accept }) {
      if (!isMember()) throw forbidden();
      const i = db.friendships.findIndex((f) => f.id === p_id && f.addressee === uid() && f.status === 'pending');
      if (i < 0) return;
      if (p_accept) db.friendships[i].status = 'accepted';
      else db.friendships.splice(i, 1);
    },
    remove_friend({ p_user }) {
      if (!isMember()) throw forbidden();
      db.friendships = db.friendships.filter((f) => f !== pair(uid(), p_user));
    },
    admin_overview() {
      if (!isAdmin()) throw forbidden();
      return {
        member_cap: db.cap,
        active: active().length,
        members: Object.entries(db.users).map(([id, u]) => ({
          user_id: id, username: u.username, display_name: u.display_name, avatar: u.avatar, role: u.role, status: u.status,
          joined_at: u.joined_at, invite_code: u.invite_code, invited_by: db.users[u.invited_by]?.username || null,
          reported_at: db.stats[id]?.reported_at, xp: db.stats[id]?.xp,
        })),
        invites: Object.entries(db.invites).map(([c, i]) => ({ code: c, ...i, used_by: db.users[i.used_by]?.username || null }))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
      };
    },
    admin_create_invite({ p_note, p_days }) {
      if (!isAdmin()) throw forbidden();
      const c = `HQ-${code(4)}-${code(4)}`;
      db.invites[c] = { note: p_note, grants_admin: false, created_by: uid(), created_at: new Date().toISOString(), expires_at: new Date(Date.now() + Math.min(Math.max(p_days || 7, 1), 30) * 864e5).toISOString(), used_at: null, used_by: null };
      return c;
    },
    admin_delete_invite({ p_code }) {
      if (!isAdmin()) throw forbidden();
      if (db.invites[p_code] && !db.invites[p_code].used_at) delete db.invites[p_code];
    },
    admin_set_member_status({ p_user, p_status }) {
      if (!isAdmin()) throw forbidden();
      if (p_user === uid()) throw new Error('HQ_SELF');
      if (p_status === 'active' && db.users[p_user].status === 'revoked' && active().length >= db.cap) throw new Error('HQ_FULL');
      db.users[p_user].status = p_status;
    },
    admin_set_cap({ p_cap }) {
      if (!isAdmin()) throw forbidden();
      db.cap = Math.min(Math.max(p_cap, 1), 100);
    },
  };

  return {
    async session() { await wait(60); return db.users[db.session] ? db.session : null; },
    async signUp(username, password, meta) {
      await wait();
      const st = rpcs.check_invite({ p_code: meta.invite, p_username: username });
      if (st !== 'ok') throw new Error('Database error saving new user');
      const id = `u-${username}`;
      const inv = db.invites[meta.invite];
      db.users[id] = {
        password, username, display_name: meta.display_name || username, avatar: meta.avatar || '🐼',
        role: inv.grants_admin ? 'admin' : 'member', status: 'active', friend_code: code(6),
        invited_by: inv.created_by, invite_code: meta.invite, joined_at: new Date().toISOString(),
      };
      db.stats[id] = { xp: 0, level: 1, streak: 0, best_streak: 0, last_day: null, words_learned: 0, words_mastered: 0, lessons: 0, speed_record: 0, accuracy: 0, minutes: 0, reported_at: null };
      Object.assign(inv, { used_at: new Date().toISOString(), used_by: id });
      if (inv.created_by) db.friendships.push({ id: db.seq++, requester: inv.created_by, addressee: id, status: 'accepted', created_at: new Date().toISOString() });
      if (inv.grants_admin) {
        // dados de demonstração: Ana já é amiga e Bruno mandou um pedido
        db.friendships.push({ id: db.seq++, requester: 'u-ana', addressee: id, status: 'accepted', created_at: new Date().toISOString() });
        db.friendships.push({ id: db.seq++, requester: 'u-bruno', addressee: id, status: 'pending', created_at: new Date().toISOString() });
      }
      db.session = id;
      persist();
      return id;
    },
    async signIn(username, password) {
      await wait();
      const e = Object.entries(db.users).find(([, u]) => u.username === username && u.password === password);
      if (!e) throw new Error('Invalid login credentials');
      db.session = e[0];
      persist();
      return e[0];
    },
    async signOut() { db.session = null; persist(); },
    async rpc(fn, args = {}) {
      await wait();
      if (!rpcs[fn]) throw new Error(`mock: função ${fn} não existe`);
      if (fn !== 'check_invite' && !db.session) throw forbidden();
      const r = rpcs[fn](args);
      persist();
      return r ?? null;
    },
  };
}
