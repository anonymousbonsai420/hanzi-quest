// Exercício · Fala: reconhecimento de voz com nota por caractere (ou gravar e comparar).
import { h } from '../lib/dom.js';
import { sfx } from '../audio.js';
import { asrSupported, recordSupported, listen, scoreSpeech, ERROR_TEXT, recordClip } from '../speech.js';
import { speakers, hanziBlock, answerHTML, prompt } from './blocks.js';

/** Falar (reconhecimento de voz) */
export async function speakExercise(stage, ex, io) {
  const it = ex.item;
  const isSentence = [...it.plain].length > 3;
  stage.append(
    prompt(isSentence ? 'Leia a frase em voz alta' : 'Fale em voz alta', it.m),
    h('div', { class: 'head-row' }, hanziBlock(it, { size: isSentence ? 'lg' : 'xl', join: !isSentence }), speakers(it.plain, { big: false })));

  io.setSkip('Não posso falar agora');
  io.setCheck(false);

  if (!asrSupported) return speakFallback(stage, it, io);

  const charsRow = h('div', { class: 'speech-chars' }, [...it.plain].map((c) => h('span', {}, c)));
  const status = h('div', { class: 'speech-status muted' }, 'Toque no microfone e fale');
  const meter = h('div', { class: 'speech-score' });
  const mic = h('button', { class: 'mic-btn', 'aria-label': 'Falar' }, h('span', {}, '🎤'));
  stage.append(h('div', { class: 'speech-box' }, mic, status, charsRow, meter));

  let best = null, listening = null, tries = 0;
  mic.onclick = async () => {
    if (listening) { listening.stop(); return; }
    mic.classList.add('on');
    status.textContent = 'Ouvindo…';
    listening = listen({ onInterim: (t) => (status.textContent = `Ouvindo… ${t}`) });
    const res = await listening.promise;
    listening = null;
    mic.classList.remove('on');
    if (!res.alternatives.length) {
      status.textContent = ERROR_TEXT[res.error] || 'Não entendi. Tente novamente.';
      if (res.error === 'not-allowed' || res.error === 'service-not-allowed') io.setSkip('Pular');
      return;
    }
    tries++;
    const r = scoreSpeech(it.plain, res.alternatives);
    if (!best || r.score >= best.score) best = r;
    [...charsRow.children].forEach((s, i) => { s.className = r.ok[i] ? 'ok' : 'bad'; });
    const pct = Math.round(r.score * 100);
    meter.innerHTML = `<div class="meter"><div style="width:${pct}%" class="${pct >= 75 ? 'good' : pct >= 40 ? 'mid' : 'low'}"></div></div><b>${pct}%</b>`;
    status.innerHTML = `Ouvi: <span class="hz-inline">${r.heard || '—'}</span>` + (pct >= 75 ? ' 🎉' : tries < 3 ? ' — tente de novo ou verifique' : '');
    if (pct >= 75) sfx.coin();
    io.setCheck(true);
  };
  io.onCleanup(() => listening?.stop());
  io.onKey((e) => { if (e.key === ' ') { e.preventDefault(); mic.click(); } });
  const act = await io.action();
  listening?.stop();
  if (act === 'skip') return { skipped: true, skipSpeak: true };
  const ok = (best?.score || 0) >= 0.75;
  return { correct: ok, kind: 'speak', answer: answerHTML(it, !isSentence), note: ok ? `Pronúncia: ${Math.round(best.score * 100)}%` : 'Ouça o modelo com 🐢 e repita sílaba por sílaba.' };
}

/** Sem reconhecimento de voz: grava, compara de ouvido e o próprio usuário avalia. */
async function speakFallback(stage, it, io) {
  if (!recordSupported) {
    stage.append(h('p', { class: 'notice' }, 'Seu navegador não permite usar o microfone aqui. Repita em voz alta ouvindo o modelo e continue.'));
    io.setCheck(true, 'Continuar');
    await io.action();
    return { skipped: true };
  }
  const audio = h('audio', { controls: true, class: 'hidden' });
  const status = h('div', { class: 'speech-status muted' }, 'Seu navegador não reconhece fala. Grave sua voz e compare com o modelo.');
  const mic = h('button', { class: 'mic-btn', 'aria-label': 'Gravar' }, h('span', {}, '🎙️'));
  const judge = h('div', { class: 'chip-row hidden' },
    h('button', { class: 'btn green', onClick: () => io.resolveWith?.({ correct: true, kind: 'speak' }) }, '✓ Soou igual'),
    h('button', { class: 'btn ghost', onClick: () => io.resolveWith?.({ correct: false, kind: 'speak' }) }, '✗ Ainda não'));
  stage.append(h('div', { class: 'speech-box' }, mic, status, audio, judge));
  mic.onclick = async () => {
    mic.classList.add('on');
    status.textContent = 'Gravando… (3 s)';
    try {
      audio.src = await recordClip(3000);
      audio.classList.remove('hidden');
      judge.classList.remove('hidden');
      status.textContent = 'Ouça sua gravação e o modelo. Como foi?';
    } catch {
      status.textContent = 'Não foi possível acessar o microfone.';
    }
    mic.classList.remove('on');
  };
  const res = await new Promise((resolve) => {
    io.resolveWith = resolve;
    io.action().then((a) => resolve(a === 'skip' ? { skipped: true, skipSpeak: true } : { correct: false }));
  });
  io.resolveWith = null;
  return { ...res, answer: answerHTML(it, [...it.plain].length <= 3) };
}
