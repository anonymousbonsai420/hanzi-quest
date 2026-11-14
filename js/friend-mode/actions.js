// Modo Amigos: executa a ação de um botão (estado ocupado, mensagem de sucesso ou do erro do servidor, redesenho).
import { toast } from '../ui/toast.js';
import { rerender } from '../screens/rerender.js';
import { errorMessage } from './cloud.js';

/** Executa uma ação de botão com estado "ocupado", mensagem de sucesso e re-renderização. */
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
