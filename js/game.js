// Mecânicas de gamificação: XP, níveis, ofensiva, vidas, moedas, missões e conquistas.
import { state, save } from './state.js';
import { bus } from './lib/events.js';
import { sample, pick } from './lib/random.js';
import { todayKey, dayDiff, addDays } from './lib/time.js';
import { UNITS } from './data.js';

export const HEART_MAX = 5;
export const HEART_MS = 20 * 60e3;
export const PRICES = { freeze: 60, refill: 40, heart: 10 };

// ---------- Níveis ----------
const TITLES = [
  [1, '初学者', 'Iniciante'],
  [3, '学生', 'Estudante'],
  [5, '书生', 'Letrado'],
  [8, '学者', 'Erudito'],
  [12, '大师', 'Mestre'],
  [17, '龙', 'Dragão'],
];
export function levelInfo(xp = state.xp) {
  let n = 1;
  while (25 * (n + 1) * n <= xp) n++;
  const cur = 25 * n * (n - 1), next = 25 * (n + 1) * n;
  const [, zh, pt] = [...TITLES].reverse().find(([min]) => n >= min);
  return { level: n, cur, next, pct: (xp - cur) / (next - cur), zh, pt };
}

// ---------- XP e meta diária ----------
export const todayXp = () => state.days[todayKey()] || 0;

export function addXp(n) {
  if (n <= 0) return;
  const before = levelInfo().level;
  const goalBefore = todayXp() >= state.dailyGoal;
  state.xp += n;
  const k = todayKey();
  state.days[k] = (state.days[k] || 0) + n;
  track('xp', n);
  const after = levelInfo();
  if (after.level > before) {
    addCoins(20);
    bus.emit('levelup', after);
  }
  if (!goalBefore && todayXp() >= state.dailyGoal) bus.emit('goal', state.dailyGoal);
  save();
  bus.emit('change');
}

export function addCoins(n) {
  state.coins = Math.max(0, state.coins + n);
  save();
  bus.emit('change');
}

// ---------- Ofensiva (streak) ----------
export function checkStreakOnLoad() {
  if (!state.lastDay) return;
  const gap = dayDiff(state.lastDay, todayKey());
  if (gap <= 1) return;
  const missed = gap - 1;
  if (state.freezes >= missed) {
    state.freezes -= missed;
    state.lastDay = addDays(todayKey(), -1);
    bus.emit('freezeUsed', missed);
  } else {
    if (state.streak > 0) bus.emit('streakLost', state.streak);
    state.streak = 0;
  }
  save();
}

/** Marca atividade de hoje. Retorna true se a ofensiva aumentou. */
export function touchStreak() {
  const t = todayKey();
  if (state.lastDay === t) return false;
  const gap = state.lastDay ? dayDiff(state.lastDay, t) : 99;
  state.streak = gap === 1 ? state.streak + 1 : 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.lastDay = t;
  save();
  bus.emit('streak', state.streak);
  bus.emit('change');
  return true;
}
export const practicedToday = () => state.lastDay === todayKey();

// ---------- Vidas ----------
export function refreshHearts() {
  if (state.hearts >= HEART_MAX) { state.heartsTs = Date.now(); return; }
  const gained = Math.floor((Date.now() - state.heartsTs) / HEART_MS);
  if (gained > 0) {
    state.hearts = Math.min(HEART_MAX, state.hearts + gained);
    state.heartsTs += gained * HEART_MS;
    save();
    bus.emit('change');
  }
}
export function nextHeartIn() {
  return state.hearts >= HEART_MAX ? 0 : Math.max(0, HEART_MS - (Date.now() - state.heartsTs));
}
export function loseHeart() {
  if (state.hearts >= HEART_MAX) state.heartsTs = Date.now();
  state.hearts = Math.max(0, state.hearts - 1);
  save();
  bus.emit('change');
}
export function gainHeart(n = 1) {
  state.hearts = Math.min(HEART_MAX, state.hearts + n);
  save();
  bus.emit('change');
}

// ---------- Loja ----------
export function buy(item) {
  const price = PRICES[item];
  if (state.coins < price) return false;
  if (item === 'freeze' && state.freezes >= 2) return false;
  if ((item === 'refill' || item === 'heart') && state.hearts >= HEART_MAX) return false;
  state.coins -= price;
  if (item === 'freeze') state.freezes++;
  if (item === 'refill') state.hearts = HEART_MAX;
  if (item === 'heart') state.hearts = Math.min(HEART_MAX, state.hearts + 1);
  save();
  bus.emit('change');
  return true;
}

// ---------- Missões diárias ----------
const QUEST_POOL = [
  { type: 'xp', targets: [30, 50], icon: '⚡', text: (t) => `Ganhe ${t} XP` },
  { type: 'lesson', targets: [2, 3], icon: '📘', text: (t) => `Complete ${t} lições` },
  { type: 'speak', targets: [5, 8], icon: '🎤', text: (t) => `Acerte ${t} exercícios de fala` },
  { type: 'write', targets: [3, 5], icon: '🖌️', text: (t) => `Escreva ${t} palavras corretamente` },
  { type: 'tone', targets: [10, 15], icon: '🎵', text: (t) => `Identifique ${t} tons` },
  { type: 'review', targets: [8, 12], icon: '🔁', text: (t) => `Revise ${t} palavras` },
  { type: 'perfect', targets: [1], icon: '💎', text: () => 'Termine uma lição sem erros' },
  { type: 'combo', targets: [8, 12], icon: '🔥', text: (t) => `Acerte ${t} seguidas` },
];

export function ensureQuests() {
  const t = todayKey();
  if (state.quests?.day === t) return state.quests;
  const picked = sample(QUEST_POOL, 3);
  state.quests = {
    day: t,
    chest: false,
    list: picked.map((q) => {
      const target = pick(q.targets);
      return { type: q.type, icon: q.icon, text: q.text(target), target, progress: 0, reward: target > 10 ? 15 : 10, done: false };
    }),
  };
  save();
  return state.quests;
}

export function track(type, amount = 1) {
  const qs = ensureQuests();
  for (const q of qs.list) {
    if (q.type !== type || q.done) continue;
    q.progress = type === 'combo' ? Math.max(q.progress, amount) : q.progress + amount;
    if (q.progress >= q.target) {
      q.progress = q.target;
      q.done = true;
      state.coins += q.reward;
      bus.emit('quest', q);
    }
  }
  if (!qs.chest && qs.list.every((q) => q.done)) {
    qs.chest = true;
    state.coins += 30;
    bus.emit('chest', 30);
  }
  save();
}

// ---------- Conquistas ----------
const learnedCount = (s) => Object.keys(s.srs).length;
export const ACHIEVEMENTS = [
  { id: 'first', icon: '🐣', name: 'Primeiro passo', desc: 'Complete sua primeira lição', test: (s) => s.stats.lessons >= 1 },
  { id: 'perfect', icon: '💎', name: 'Perfeccionista', desc: 'Termine uma lição sem erros', test: (s) => s.stats.perfectLessons >= 1 },
  { id: 'streak3', icon: '🔥', name: 'Aquecendo', desc: 'Ofensiva de 3 dias', test: (s) => s.bestStreak >= 3 },
  { id: 'streak7', icon: '🏮', name: 'Uma semana!', desc: 'Ofensiva de 7 dias', test: (s) => s.bestStreak >= 7 },
  { id: 'streak30', icon: '🐉', name: 'Disciplina de dragão', desc: 'Ofensiva de 30 dias', test: (s) => s.bestStreak >= 30 },
  { id: 'words25', icon: '📚', name: 'Primeiras 25', desc: 'Aprenda 25 palavras', test: (s) => learnedCount(s) >= 25 },
  { id: 'words50', icon: '🎓', name: 'Meia centena', desc: 'Aprenda 50 palavras', test: (s) => learnedCount(s) >= 50 },
  { id: 'unit', icon: '🏅', name: 'Unidade concluída', desc: 'Complete uma unidade inteira', test: (s) => s.stats.unitsDone >= 1 },
  { id: 'allunits', icon: '👑', name: 'Imperador', desc: 'Complete todas as unidades', test: (s) => s.stats.unitsDone >= UNITS.length },
  { id: 'speak10', icon: '🎤', name: 'Boca de ouro', desc: 'Acerte 10 exercícios de fala', test: (s) => s.stats.speakOk >= 10 },
  { id: 'speak50', icon: '📣', name: 'Orador', desc: 'Acerte 50 exercícios de fala', test: (s) => s.stats.speakOk >= 50 },
  { id: 'write10', icon: '🖌️', name: 'Calígrafo aprendiz', desc: 'Escreva 10 palavras corretamente', test: (s) => s.stats.writeOk >= 10 },
  { id: 'write50', icon: '🪶', name: 'Mestre do pincel', desc: 'Escreva 50 palavras corretamente', test: (s) => s.stats.writeOk >= 50 },
  { id: 'tone20', icon: '🎵', name: 'Ouvido afinado', desc: 'Identifique 20 tons', test: (s) => s.stats.toneOk >= 20 },
  { id: 'tone100', icon: '🎼', name: 'Ouvido absoluto', desc: 'Identifique 100 tons', test: (s) => s.stats.toneOk >= 100 },
  { id: 'speed15', icon: '⚡', name: 'Relâmpago', desc: '15 pontos no Desafio relâmpago', test: (s) => s.stats.bestSpeed >= 15 },
  { id: 'combo15', icon: '🎯', name: 'Na mosca', desc: 'Acerte 15 seguidas', test: (s) => s.stats.bestCombo >= 15 },
  { id: 'review100', icon: '🐘', name: 'Memória de elefante', desc: 'Faça 100 revisões', test: (s) => s.stats.reviews >= 100 },
  { id: 'level5', icon: '⭐', name: 'Nível 5', desc: 'Alcance o nível 5', test: (s) => levelInfo(s.xp).level >= 5 },
  { id: 'level10', icon: '🌟', name: 'Nível 10', desc: 'Alcance o nível 10', test: (s) => levelInfo(s.xp).level >= 10 },
  // modo Amigos
  { id: 'friend1', icon: '🤝', name: 'Turma formada', desc: 'Tenha seu primeiro amigo no modo Amigos', test: (s) => s.cloud?.friends >= 1 },
  { id: 'champion', icon: '🥇', name: 'Campeão da semana', desc: 'Termine uma semana em 1º lugar entre amigos', test: (s) => s.cloud?.weeklyWins >= 1 },
  { id: 'champion3', icon: '🏆', name: 'Tricampeão', desc: 'Vença 3 semanas entre amigos', test: (s) => s.cloud?.weeklyWins >= 3 },
  { id: 'speedtop', icon: '💨', name: 'Mais rápido da turma', desc: 'Tenha o maior recorde do Desafio relâmpago entre seus amigos', test: (s) => !!s.cloud?.speedTop },
];

export function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !a.test(state)) continue;
    state.achievements[a.id] = Date.now();
    state.coins += 15;
    fresh.push(a);
  }
  if (fresh.length) {
    save();
    fresh.forEach((a) => bus.emit('achievement', a));
    bus.emit('change');
  }
  return fresh;
}
