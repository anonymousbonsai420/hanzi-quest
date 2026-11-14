// Modal genérico (diálogo com título, conteúdo e botões).
import { h } from '../lib/dom.js';

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
