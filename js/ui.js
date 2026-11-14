// Componentes de interface: toasts, modais, confete.
import { h, todayKey, addDays } from './util.js';

export function toast(content, { icon = '✨', kind = '', ms = 3500 } = {}) {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast ${kind}` }, h('span', { class: 'toast-icon' }, icon), h('div', { class: 'toast-body', html: content }));
  box.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

/** Modal genérico. Retorna uma Promise com o `value` da ação clicada (ou null). */
export function modal({ title, body, actions = [{ label: 'OK', value: true }], dismissable = true, className = '' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modals');
    let closed = false;
    const close = (v) => {
      if (closed) return;
      closed = true;
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 250);
      document.removeEventListener('keydown', onKey);
      wrap.dispatchEvent(new CustomEvent('closed'));
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(null); };
    const card = h('div', { class: `modal ${className}`, role: 'dialog', 'aria-modal': 'true' },
      title && h('h2', { class: 'modal-title' }, title),
      h('div', { class: 'modal-body' }, typeof body === 'string' ? h('div', { html: body }) : body),
      actions.length > 0 && h('div', { class: 'modal-actions' },
        actions.map((a) => h('button', { class: `btn ${a.class || ''}`, onClick: () => close(a.value) }, a.label))));
    const wrap = h('div', { class: 'modal-wrap', onClick: (e) => { if (e.target === wrap && dismissable) close(null); } }, card);
    root.append(wrap);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => wrap.classList.add('in'));
    wrap._close = close;
  });
}

export function confetti(n = 140) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = h('canvas', { class: 'confetti' });
  document.body.append(c);
  const W = (c.width = innerWidth), H = (c.height = innerHeight);
  const g = c.getContext('2d');
  const colors = ['#d62839', '#f2a51a', '#16a36b', '#2f6fdf', '#b5179e', '#ffd166'];
  const ps = Array.from({ length: n }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (t) => {
    g.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c;
      g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore();
    }
    if (t - t0 < 3200) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

/** Mapa de atividade: um quadradinho por dia (semanas em colunas, segunda no topo). days: 'AAAA-MM-DD' → XP */
export function heatmap(days, weeks = 12) {
  const today = todayKey();
  const dow = (new Date().getDay() + 6) % 7; // segunda = 0
  const start = addDays(today, -(weeks * 7 - 1) - (6 - dow));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    const xp = days[k] || 0;
    const lvl = xp === 0 ? 0 : xp < 10 ? 1 : xp < 25 ? 2 : xp < 50 ? 3 : 4;
    cells.push(h('i', { class: `hm l${lvl} ${k > today ? 'future' : ''}`, title: `${k}: ${xp} XP` }));
  }
  return h('div', { class: 'heatmap' }, cells);
}
