// Conversão e verificação de pinyin.

const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
const UNMARK = {};
for (const [base, s] of Object.entries(MARKS)) [...s].forEach((c, i) => (UNMARK[c] = [base, i + 1]));

const SYL_RE = /[a-züv:]+[0-5]?/gi;

/** "hao3" → "hǎo" */
export function markSyllable(syl) {
  const m = /^([a-zü]+?)([0-5])?$/i.exec(syl.replace(/u:/g, 'ü').replace(/v/g, 'ü'));
  if (!m) return syl;
  const base = m[1];
  const tone = +(m[2] || 5);
  if (tone === 5 || tone === 0) return base;
  let idx = -1;
  if (base.includes('a')) idx = base.indexOf('a');
  else if (base.includes('e')) idx = base.indexOf('e');
  else if (base.includes('ou')) idx = base.indexOf('o');
  else for (let i = base.length - 1; i >= 0; i--) if ('aeiouü'.includes(base[i])) { idx = i; break; }
  if (idx < 0) return base;
  return base.slice(0, idx) + MARKS[base[idx]][tone - 1] + base.slice(idx + 1);
}

export const syllables = (p) => p.match(SYL_RE) || [];
export const toneOfSyl = (s) => +(s.match(/[0-5]$/)?.[0] || 5) || 5;
export const tonesOf = (p) => syllables(p).map(toneOfSyl);
export const toneless = (s) => s.replace(/[0-5]$/, '').replace(/u:|ü/g, 'v').toLowerCase();

function groups(p, join) {
  return join ? [p.replace(/\s+/g, '')] : p.trim().split(/\s+/);
}
const NEEDS_APOS = /^[aeoāáǎàēéěèōóǒò]/;

/** "ni3 hao3" → "nǐ hǎo" (join=true → "nǐhǎo") */
export function toMarked(p, { join = false } = {}) {
  return groups(p, join)
    .map((g) => (g.match(SYL_RE) || [g]).map((s, i) => {
      const mk = markSyllable(s);
      return i > 0 && NEEDS_APOS.test(mk) ? "'" + mk : mk;
    }).join(''))
    .join(' ');
}

/** HTML com cada sílaba colorida pela cor do tom. */
export function pinyinHTML(p, { join = false } = {}) {
  return groups(p, join)
    .map((g) => (g.match(SYL_RE) || [g]).map((s, i) => {
      let mk = markSyllable(s);
      if (i > 0 && NEEDS_APOS.test(mk)) mk = "'" + mk;
      return `<span class="t${toneOfSyl(s)}">${mk}</span>`;
    }).join(''))
    .join(' ');
}

/** Lê o que o usuário digitou: aceita "ni3 hao3", "nǐ hǎo", "nv3", "nu:3", "nü3". */
export function parseInput(str) {
  str = str.toLowerCase().normalize('NFC').replace(/u:/g, 'v').replace(/ü/g, 'v');
  let letters = '';
  const tones = [];
  for (const ch of str) {
    if (UNMARK[ch]) {
      const [b, t] = UNMARK[ch];
      letters += b === 'ü' ? 'v' : b;
      tones.push(t);
    } else if (/[a-z]/.test(ch)) letters += ch;
    else if (/[1-4]/.test(ch)) tones.push(+ch);
  }
  return { letters, tones };
}

/** Tons aceitos por sílaba, incluindo sandhi (不, 一 e 3º+3º tom). */
function targetForms(p) {
  const syls = syllables(p);
  const base = syls.map(toneless);
  const tones = syls.map(toneOfSyl);
  const options = tones.map((t, i) => {
    const set = new Set([t]);
    const next = tones[i + 1];
    if (base[i] === 'bu' && t === 4 && next === 4) set.add(2);
    if (base[i] === 'yi' && t === 1 && next && next !== 5) set.add(next === 4 ? 2 : 4);
    if (t === 3 && next === 3) set.add(2);
    return set;
  });
  return { letters: base.join(''), options };
}

export function checkPinyin(input, p) {
  const u = parseInput(input);
  const tg = targetForms(p);
  const lettersOk = u.letters === tg.letters;
  const req = tg.options.filter((s) => !s.has(5));
  const tonesOk = u.tones.length === req.length && u.tones.every((t, i) => req[i].has(t));
  return { ok: lettersOk && tonesOk, lettersOk, tonesOk, noTones: u.tones.length === 0 };
}

/** Desenho do contorno de tom (escala de Chao 1–5) como SVG. */
const CONTOURS = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 4], 4: [5, 1], 5: [3, 3] };
export function toneSVG(tone, { w = 56, h = 40, cls = '' } = {}) {
  const pts = CONTOURS[tone];
  const y = (v) => h - 4 - ((v - 1) / 4) * (h - 8);
  const step = (w - 12) / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${6 + i * step},${y(v)}`).join(' ');
  const path = pts.length === 3
    ? `M6,${y(pts[0])} Q${w / 2},${y(0)} ${w - 6},${y(pts[2])}`
    : d;
  return `<svg class="tone-svg ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    ${[1, 2, 3, 4, 5].map((v) => `<line x1="2" x2="${w - 2}" y1="${y(v)}" y2="${y(v)}" class="tone-grid"/>`).join('')}
    <path d="${path}" class="tone-line t${tone}-stroke" fill="none"/></svg>`;
}
export const CHAO = CONTOURS;
export const TONE_NAMES = { 1: '1º tom — alto e plano', 2: '2º tom — sobe', 3: '3º tom — desce e sobe', 4: '4º tom — cai forte', 5: 'tom neutro' };
