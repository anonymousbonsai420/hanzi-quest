// Exercício · Palavra nova: hanzi, pinyin, significado, áudio e animação dos traços.
import { h } from '../lib/dom.js';
import { speak } from '../audio.js';
import { writerAvailable, gridBox, animateLoop } from '../writer.js';
import { speakers, hanziBlock } from './blocks.js';

/** Apresenta uma palavra nova. */
export async function introExercise(stage, ex, io) {
  const w = ex.w;
  const strokes = h('div', { class: 'stroke-row' });
  stage.append(
    h('div', { class: 'badge-new' }, '✨ Palavra nova'),
    h('div', { class: 'intro-card' },
      hanziBlock(w, { pinyin: true, meaning: true, size: 'xxl' }),
      speakers(w.h),
      strokes,
      h('p', { class: 'muted small' }, 'Toque no caractere para ouvir de novo. Observe a ordem dos traços.')));
  if (writerAvailable()) {
    const chars = [...w.h];
    const size = chars.length > 2 ? 84 : 110;
    chars.forEach((c) => {
      const { wrap, target } = gridBox(size);
      strokes.append(wrap);
      const loop = animateLoop(target, c, size);
      io.onCleanup(loop.stop);
    });
  }
  speak(w.h);
  io.setCheck(true, 'Continuar');
  await io.action();
  return { intro: true };
}
