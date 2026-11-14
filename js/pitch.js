// Detecção de altura (pitch) da voz para o "Espelho de tons".
import { CHAO } from './pinyin.js';

function detectPitch(buf, sr) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.012) return null;
  const minLag = Math.floor(sr / 450), maxLag = Math.min(Math.floor(sr / 70), n >> 1);
  const corr = new Float32Array(maxLag + 1);
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < n - lag; i++) {
      const a = buf[i], b = buf[i + lag];
      c += a * b; e1 += a * a; e2 += b * b;
    }
    corr[lag] = c / Math.sqrt(e1 * e2 + 1e-9);
    if (corr[lag] > best) best = corr[lag];
  }
  if (best < 0.6) return null;
  // menor lag com correlação próxima do máximo → evita erros de oitava
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] >= best * 0.92 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) return sr / lag;
  }
  return null;
}

/** Grava a voz por `ms` e retorna [{t, f}] (f = Hz ou null). */
export async function recordPitch(ms = 1600, onFrame) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const pts = [];
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const t = performance.now() - t0;
      an.getFloatTimeDomainData(buf);
      pts.push({ t, f: detectPitch(buf, ctx.sampleRate) });
      onFrame?.(pts);
      if (t < ms) requestAnimationFrame(tick);
      else {
        stream.getTracks().forEach((tr) => tr.stop());
        ctx.close();
        resolve(pts);
      }
    };
    tick();
  });
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/** Converte para semitons relativos à mediana, suaviza e recorta silêncio. */
export function contour(pts) {
  const voiced = pts.filter((p) => p.f);
  if (voiced.length < 6) return null;
  const med = median(voiced.map((p) => p.f));
  let st = voiced.map((p) => ({ t: p.t, v: 12 * Math.log2(p.f / med) }))
    .filter((p) => Math.abs(p.v) < 12);
  // filtro de mediana (janela 5)
  st = st.map((p, i) => ({ t: p.t, v: median(st.slice(Math.max(0, i - 2), i + 3).map((q) => q.v)) }));
  if (st.length < 6) return null;
  const t0 = st[0].t, t1 = st[st.length - 1].t;
  return st.map((p) => ({ x: (p.t - t0) / Math.max(1, t1 - t0), v: p.v }));
}

/** Heurística para estimar o tom produzido a partir do contorno. */
export function classify(c) {
  if (!c) return null;
  const n = c.length;
  const seg = (a, b) => { const s = c.slice(Math.floor(n * a), Math.max(Math.floor(n * a) + 1, Math.floor(n * b))); return s.reduce((x, p) => x + p.v, 0) / s.length; };
  const start = seg(0, 0.2), mid = seg(0.35, 0.65), end = seg(0.8, 1);
  const vals = c.map((p) => p.v);
  const range = Math.max(...vals) - Math.min(...vals);
  const minIdx = vals.indexOf(Math.min(...vals)) / n;
  if (range < 2.2) return 1;
  if (start - end > 3 && start >= mid) return 4;
  if (mid < start - 1 && mid < end - 1 && minIdx > 0.2 && minIdx < 0.85) return 3;
  if (end - start > 2) return 2;
  if (start - end > 1.5) return 4;
  return 1;
}

/** Desenha o contorno alvo e o do usuário num canvas. */
export function drawContours(canvas, tone, userContour, colors) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  const pad = 18;
  const y = (lvl) => H - pad - ((lvl - 1) / 4) * (H - 2 * pad);
  const x = (f) => pad + f * (W - 2 * pad);
  g.strokeStyle = colors.grid; g.lineWidth = 1;
  for (let l = 1; l <= 5; l++) { g.beginPath(); g.moveTo(pad, y(l)); g.lineTo(W - pad, y(l)); g.stroke(); }
  // alvo
  const pts = CHAO[tone];
  g.setLineDash([8, 6]); g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = colors.target;
  g.beginPath();
  if (pts.length === 3) { g.moveTo(x(0), y(pts[0])); g.quadraticCurveTo(x(0.5), y(0), x(1), y(pts[2])); }
  else { g.moveTo(x(0), y(pts[0])); g.lineTo(x(1), y(pts[1])); }
  g.stroke(); g.setLineDash([]);
  if (!userContour) return;
  // usuário: alinha a média com a média do alvo (comparação de forma), ~3 semitons por nível
  const targetMean = pts.length === 3 ? 2.2 : (pts[0] + pts[1]) / 2;
  const mean = userContour.reduce((s, p) => s + p.v, 0) / userContour.length;
  g.strokeStyle = colors.user; g.lineWidth = 4;
  g.beginPath();
  userContour.forEach((p, i) => {
    const lvl = Math.max(0.6, Math.min(5.4, targetMean + (p.v - mean) / 3));
    i ? g.lineTo(x(p.x), y(lvl)) : g.moveTo(x(p.x), y(lvl));
  });
  g.stroke();
}
