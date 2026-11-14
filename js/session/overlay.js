// Tela cheia das sessões: abre e fecha a sobreposição (e avisa o app para soltar as celebrações).
import { h, bus } from '../util.js';
import { stopSpeaking } from '../audio.js';

export function mountOverlay(cls = '') {
  const root = document.getElementById('overlay');
  const el = h('div', { class: `session ${cls}` });
  root.replaceChildren(el);
  root.classList.add('open');
  document.body.classList.add('in-session');
  return el;
}
export function unmountOverlay() {
  const root = document.getElementById('overlay');
  root.classList.remove('open');
  root.replaceChildren();
  document.body.classList.remove('in-session');
  stopSpeaking();
  bus.emit('overlayClosed');
}
