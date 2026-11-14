// Exercício · Escrita: desenhar o caractere no quadriculado 田字格, traço a traço.
import { h } from '../lib/dom.js';
import { sleep } from '../lib/time.js';
import { pinyinHTML } from '../pinyin.js';
import { speak, sfx } from '../audio.js';
import { writerAvailable, gridBox, createWriter } from '../writer.js';
import { mastery } from '../srs.js';
import { speakers, answerHTML, prompt } from './blocks.js';

/** Escrever com ordem de traços */
export async function writeExercise(stage, ex, io) {
  const w = ex.w;
  io.setSkip('Pular escrita');
  io.setCheck(false);
  if (!writerAvailable()) {
    stage.append(prompt('Escrita indisponível', 'Não foi possível carregar os dados de traços (verifique a internet).'));
    await io.action();
    return { skipped: true };
  }
  const chars = [...w.h];
  const trace = ex.trace ?? mastery(w.id) < 2;
  const size = Math.min(300, Math.max(220, stage.clientWidth - 40));
  const dots = h('div', { class: 'write-dots' }, chars.map(() => h('span')));
  const info = h('div', { class: 'muted small write-info' }, trace ? 'Siga o contorno, traço a traço.' : 'Desenhe de memória. Errou 3 vezes? Aparece uma dica.');
  const { wrap, target } = gridBox(size);
  const btnOutline = h('button', { class: 'chip' }, trace ? '🙈 Esconder contorno' : '👁 Mostrar contorno');
  const btnAnim = h('button', { class: 'chip' }, '▶ Ver ordem dos traços');
  stage.append(
    prompt('Escreva', `${w.m}`),
    h('div', { class: 'head-row center' }, h('div', { class: 'py big', html: pinyinHTML(w.p, { join: true }) }), speakers(w.h, { big: false })),
    dots, h('div', { class: 'write-area' }, wrap), info,
    h('div', { class: 'chip-row' }, btnOutline, btnAnim));

  let idx = 0, mistakes = 0, strokes = 0, outline = trace, writer, penalties = 0;
  let finishAll;
  const allDone = new Promise((r) => (finishAll = r));
  const startQuiz = () => {
    writer.quiz({
      leniency: 1.25,
      showHintAfterMisses: 3,
      highlightOnComplete: true,
      onMistake: () => { mistakes++; },
      onCorrectStroke: () => { strokes++; sfx.tap(); },
      onComplete: async () => {
        dots.children[idx].classList.add('done');
        speak(chars[idx]);
        await sleep(650);
        idx++;
        if (idx < chars.length) {
          dots.children[idx].classList.add('cur');
          await writer.setCharacter(chars[idx]);
          if (!outline) writer.hideOutline();
          startQuiz();
        } else finishAll();
      },
    });
  };
  writer = createWriter(target, chars[0], size, { showOutline: outline });
  dots.children[0].classList.add('cur');
  startQuiz();

  btnOutline.onclick = () => {
    outline = !outline;
    outline ? writer.showOutline() : writer.hideOutline();
    btnOutline.textContent = outline ? '🙈 Esconder contorno' : '👁 Mostrar contorno';
  };
  btnAnim.onclick = async () => {
    penalties++;
    writer.cancelQuiz();
    await writer.animateCharacter();
    await sleep(400);
    writer.hideCharacter();
    if (!outline) writer.hideOutline();
    startQuiz();
  };
  const res = await Promise.race([allDone.then(() => 'done'), io.action()]);
  try { writer.cancelQuiz(); } catch {}
  if (res === 'skip') return { skipped: true };
  const allowed = Math.max(2, Math.ceil(strokes * 0.35));
  const ok = mistakes + penalties * 2 <= allowed;
  return {
    correct: ok, kind: 'write', answer: answerHTML(w),
    note: ok ? (mistakes === 0 ? 'Traços perfeitos! 🖌️' : `${mistakes} erro(s) de traço — bom trabalho.`) : `${mistakes} erros de traço. Observe a ordem: de cima para baixo, da esquerda para a direita.`,
  };
}
