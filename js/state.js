// Estado persistente do jogador (localStorage).

const KEY = 'hanziquest:v1';

const DEFAULTS = () => ({
  onboarded: false,
  created: Date.now(),
  xp: 0,
  coins: 50,
  hearts: 5,
  heartsTs: Date.now(),
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  freezes: 0,
  dailyGoal: 20,
  days: {},          // 'AAAA-MM-DD' → XP ganho no dia
  srs: {},           // id da palavra → cartão de repetição espaçada
  progress: {},      // id da unidade → nº de lições concluídas
  achievements: {},  // id → timestamp
  quests: null,      // { day, list:[...], chest }
  stats: {
    lessons: 0, perfectLessons: 0, unitsDone: 0,
    speakOk: 0, writeOk: 0, toneOk: 0, reviews: 0,
    correct: 0, wrong: 0, bestSpeed: 0, bestCombo: 0, minutes: 0,
  },
  settings: {
    ttsRate: 0.8, sound: true, showPinyin: true, speaking: true, writing: true, theme: 'auto',
  },
  cloud: {           // modo Amigos (cache do servidor; o progresso continua sendo o local)
    username: null, profile: null, overview: null, overviewAt: 0, seen: null,
    dirty: false, lastSync: 0, rewardedWeek: null, weeklyWins: 0, friends: 0, speedTop: false,
  },
});

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(def, obj) {
  if (!isObj(obj)) return def;
  const out = { ...def, ...obj };
  for (const k of ['stats', 'settings', 'cloud']) out[k] = { ...def[k], ...(obj[k] || {}) };
  return out;
}

function load() {
  try {
    return merge(DEFAULTS(), JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return DEFAULTS();
  }
}

export const state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* armazenamento indisponível */ }
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch {}
  location.reload();
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const obj = JSON.parse(json);
  const cloud = state.cloud; // a conta deste aparelho não vem no arquivo importado
  Object.assign(state, merge(DEFAULTS(), obj), { cloud });
  save();
}
