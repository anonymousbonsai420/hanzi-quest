// Integração com Hanzi Writer (ordem dos traços, animação e quiz de escrita).
import { cssVar } from './lib/dom.js';

export const writerAvailable = () => !!window.HanziWriter;

function colors() {
  return {
    strokeColor: cssVar('--ink'),
    outlineColor: cssVar('--outline'),
    drawingColor: cssVar('--ink'),
    highlightColor: cssVar('--jade'),
    radicalColor: cssVar('--red'),
  };
}

/** Cria a área quadriculada (田字格) e devolve o elemento alvo. */
export function gridBox(size) {
  const wrap = document.createElement('div');
  wrap.className = 'tian';
  wrap.style.width = wrap.style.height = size + 'px';
  wrap.innerHTML = `<svg class="tian-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect x="0.5" y="0.5" width="99" height="99"/>
    <line x1="0" y1="50" x2="100" y2="50"/><line x1="50" y1="0" x2="50" y2="100"/>
    <line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/></svg>`;
  const target = document.createElement('div');
  target.className = 'tian-target';
  wrap.append(target);
  return { wrap, target };
}

export function createWriter(target, char, size, opts = {}) {
  return window.HanziWriter.create(target, char, {
    width: size,
    height: size,
    padding: Math.round(size * 0.06),
    showCharacter: false,
    showOutline: true,
    drawingWidth: Math.max(14, Math.round(size / 11)),
    strokeAnimationSpeed: 1.1,
    delayBetweenStrokes: 180,
    ...colors(),
    ...opts,
  });
}

/** Mostra a animação da ordem dos traços em loop. */
export function animateLoop(target, char, size) {
  const w = createWriter(target, char, size, { showCharacter: false, showOutline: true });
  let alive = true;
  (async () => {
    await new Promise((r) => setTimeout(r, 200));
    while (alive) {
      await w.animateCharacter();
      await new Promise((r) => setTimeout(r, 1300));
      if (alive) w.hideCharacter();
      await new Promise((r) => setTimeout(r, 300));
    }
  })().catch(() => {});
  return { writer: w, stop: () => (alive = false) };
}
