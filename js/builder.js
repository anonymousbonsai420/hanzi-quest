// Monta as sequências de exercícios de lições, revisões e treinos.
import { UNITS, WORDS, ALL_WORDS, TONE_ITEMS } from './data.js';
import { shuffle, sample, pick } from './lib/random.js';
import { state } from './state.js';
import { isLearned, mastery } from './srs.js';
import { asrSupported, recordSupported } from './speech.js';

const canSpeak = () => state.settings.speaking && (asrSupported || recordSupported);
const canWrite = () => state.settings.writing;

/** Distratores: prioriza palavras da mesma unidade, sem repetir hanzi ou significado. */
function distractors(w, n = 3, pool = null) {
  const base = pool || ALL_WORDS;
  const ok = (o) => o.id !== w.id && o.m !== w.m && o.h !== w.h && o.p !== w.p;
  const same = shuffle(base.filter((o) => o.unit === w.unit && ok(o)));
  const other = shuffle(base.filter((o) => o.unit !== w.unit && ok(o)));
  return [...same, ...other].slice(0, n);
}
const wordsUpTo = (unitIdx) => UNITS.slice(0, unitIdx + 1).flatMap((u) => u.words);
const sentenceItem = (s) => ({ h: s.h, plain: s.plain, p: s.p, m: s.m });
const wordItem = (w) => ({ h: w.h, plain: w.h, p: w.p, m: w.m });

function sentenceDistractors(s, known) {
  const toks = new Set(s.t);
  return sample(known.map((w) => w.h).filter((x) => !toks.has(x) && x.length <= 2), 2);
}

function knownChars(extra = []) {
  const set = new Set();
  [...Object.keys(state.srs), ...extra.map((w) => w.id)].forEach((id) => [...id].forEach((c) => set.add(c)));
  return set;
}

/** Lição de aprendizado: apresenta 3–5 palavras novas e pratica de várias formas. */
export function buildLearn(unit, lesson) {
  const ws = lesson.words;
  const pool = wordsUpTo(unit.index);
  const items = [];
  for (const w of ws) {
    items.push({ type: 'intro', w });
    items.push({ type: 'mc_meaning', w, options: distractors(w, 3, pool), autoplay: false });
  }
  const mix = [];
  for (const w of ws) {
    const t = pick(['listen', 'mc_hanzi', 'listen', 'pinyin']);
    mix.push(t === 'pinyin' ? { type: 'pinyin', w } : { type: t, w, options: distractors(w, 3, pool) });
  }
  if (canSpeak()) sample(ws, 2).forEach((w) => mix.push({ type: 'speak', item: wordItem(w), words: [w.id] }));
  if (canWrite()) sample(ws.filter((w) => w.h.length <= 2), 2).forEach((w) => mix.push({ type: 'write', w, trace: true }));
  const prev = pool.filter((w) => isLearned(w.id) && !ws.includes(w));
  const matchSet = [...ws, ...sample(prev, Math.max(0, 5 - ws.length))].slice(0, 5);
  if (matchSet.length >= 3) mix.push({ type: 'match', words: matchSet });
  const kc = knownChars(ws);
  const sents = unit.sentences.filter((s) => [...s.plain].every((c) => kc.has(c)));
  if (sents.length) {
    const s = pick(sents);
    mix.push({ type: 'build', s, distractors: sentenceDistractors(s, pool) });
  }
  return [...items, ...shuffle(mix)];
}

/** Desafio da unidade: frases, fala, escrita e escuta. */
export function buildConsolidate(unit) {
  const ws = unit.words;
  const pool = wordsUpTo(unit.index);
  const out = [{ type: 'match', words: sample(ws, 5) }];
  unit.sentences.forEach((s, i) => out.push({ type: 'build', s, listen: i % 2 === 1, distractors: sentenceDistractors(s, pool) }));
  if (canSpeak()) sample(unit.sentences, 2).forEach((s) => out.push({ type: 'speak', item: sentenceItem(s), words: [] }));
  sample(ws, 2).forEach((w) => out.push({ type: 'listen', w, options: distractors(w, 3, pool) }));
  sample(ws, 2).forEach((w) => out.push({ type: 'pinyin', w }));
  if (canWrite()) sample(ws.filter((w) => w.h.length <= 2), 2).forEach((w) => out.push({ type: 'write', w }));
  return [out[0], ...shuffle(out.slice(1))];
}

/** Revisão SRS: o tipo de exercício fica mais difícil conforme o domínio da palavra. */
export function buildReview(ids) {
  const ws = ids.map((id) => WORDS[id]).filter(Boolean);
  const out = ws.map((w) => {
    const m = mastery(w.id);
    const types = m <= 2 ? ['mc_meaning', 'listen', 'mc_hanzi', 'pinyin'] : ['listen', 'pinyin', 'mc_hanzi'];
    if (canSpeak()) types.push('speak');
    if (canWrite() && w.h.length <= 2 && m >= 2) types.push('write');
    const t = pick(types);
    if (t === 'speak') return { type: 'speak', item: wordItem(w), words: [w.id] };
    if (t === 'pinyin' || t === 'write') return { type: t, w };
    return { type: t, w, options: distractors(w) };
  });
  if (ws.length >= 5) out.push({ type: 'match', words: sample(ws, 5) });
  return shuffle(out);
}

/** Palavras disponíveis para os treinos (aprendidas ou, se poucas, da 1ª unidade). */
export function practicePool(min = 4) {
  const learned = ALL_WORDS.filter((w) => isLearned(w.id));
  return learned.length >= min ? learned : [...learned, ...UNITS[0].words.filter((w) => !learned.includes(w))];
}

export function buildTones(n = 10) {
  return sample(TONE_ITEMS, n).map((item) => ({ type: 'tone', item }));
}
export function buildSpeaking(n = 8) {
  const pool = practicePool();
  const sents = UNITS.flatMap((u) => u.sentences).filter((s) => [...s.plain].every((c) => knownChars().has(c)));
  const items = [...sample(pool, Math.min(n - 2, pool.length)).map((w) => ({ type: 'speak', item: wordItem(w), words: [w.id] })),
    ...sample(sents, 2).map((s) => ({ type: 'speak', item: sentenceItem(s), words: [] }))];
  return shuffle(items);
}
export function buildWriting(n = 6) {
  return sample(practicePool().filter((w) => w.h.length <= 2), n).map((w) => ({ type: 'write', w }));
}
export function buildPinyin(n = 8) {
  return sample(practicePool(), n).map((w) => ({ type: 'pinyin', w }));
}
export function buildListening(n = 8) {
  const pool = practicePool();
  const items = sample(pool, n - 2).map((w) => ({ type: 'listen', w, options: distractors(w) }));
  const sents = UNITS.flatMap((u) => u.sentences).filter((s) => [...s.plain].every((c) => knownChars().has(c)));
  sample(sents, 2).forEach((s) => items.push({ type: 'build', s, listen: true, distractors: sentenceDistractors(s, pool) }));
  return shuffle(items);
}
