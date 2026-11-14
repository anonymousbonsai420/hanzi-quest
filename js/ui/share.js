// Compartilhar texto/link: menu de compartilhar do aparelho, senão copia, senão mostra para copiar.
import { h } from '../lib/dom.js';
import { modal } from './modal.js';
import { toast } from './toast.js';

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
