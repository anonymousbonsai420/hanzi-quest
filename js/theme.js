// Tema claro/escuro/automático (configuração salva em state.settings.theme).
import { state } from './state.js';

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
