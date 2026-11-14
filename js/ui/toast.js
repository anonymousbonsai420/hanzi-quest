// Avisos rápidos no topo da tela (toasts).
import { h } from '../lib/dom.js';

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
