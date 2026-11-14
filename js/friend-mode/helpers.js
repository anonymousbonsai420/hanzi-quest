// Modo Amigos: utilitários compartilhados pelas telas (datas, ações de botão, compartilhar, re-renderizar).
import { h } from '../util.js';
import { modal, toast } from '../ui.js';
import { errorMessage } from './cloud.js';

let rerenderFn = () => {};
export function setSocialRerender(fn) { rerenderFn = fn; }
/** Redesenha a tela atual (definido pelo app.js). */
export const rerender = () => rerenderFn();

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '—');
export const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 6e4);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`;
};

export async function act(e, fn, okMsg) {
  const btn = e?.currentTarget || e?.target?.querySelector?.('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await fn();
    if (okMsg) toast(okMsg, { icon: '✅' });
    rerender();
  } catch (err) {
    toast(errorMessage(err), { icon: '⚠️', ms: 5000 });
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function share(text, url) {
  const full = url ? `${text}\n${url}` : text;
  if (navigator.share) {
    try { await navigator.share(url ? { text, url } : { text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(full);
    toast('Copiado! Agora é só colar na conversa.', { icon: '📋' });
  } catch {
    modal({ title: 'Copie e envie', body: h('textarea', { class: 'field-input share-box', readonly: true, rows: 4 }, full) });
  }
}
