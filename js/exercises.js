// Tipos de exercício. Cada um recebe (stage, ex, io) e resolve com um resultado:
// { correct, skipped?, intro?, answer?: html, note?: html }
import { h, shuffle, sleep } from './util.js';
import { pinyinHTML, toMarked, checkPinyin, toneSVG, markSyllable, TONE_NAMES } from './pinyin.js';
import { speak, sfx } from './audio.js';
import { asrSupported, recordSupported, listen, scoreSpeech, ERROR_TEXT, recordClip } from './speech.js';
import { writerAvailable, gridBox, createWriter, animateLoop } from './writer.js';
import { WORDS } from './data.js';
import { state } from './state.js';
import { mastery } from './srs.js';

const showPy = () => state.settings.showPinyin;

// ---------- Blocos reutilizáveis ----------
function speakers(text, { big = true } = {}) {
  return h('div', { class: 'speakers' },
    h('button', { class: `audio-btn ${big ? 'big' : ''}`, title: 'Ouvir', 'aria-label': 'Ouvir', onClick: () => speak(text) }, '🔊'),
    h('button', { class: 'audio-btn slow', title: 'Ouvir devagar', 'aria-label': 'Ouvir devagar', onClick: () => speak(text, { slow: true }) }, '🐢'));
}

function hanziBlock(item, { pinyin = showPy(), meaning = false, size = 'xl', join = true } = {}) {
  return h('div', { class: 'hz-block' },
    h('button', { class: `hz ${size}`, title: 'Ouvir', onClick: () => speak(item.plain || item.h) }, item.h),
    pinyin && h('div', { class: 'py', html: pinyinHTML(item.p, { join }) }),
    meaning && h('div', { class: 'meaning' }, item.m));
}

const answerHTML = (w, join = true) =>
  `<span class="hz-inline">${w.h}</span> <span class="py-inline">${pinyinHTML(w.p, { join })}</span> — ${w.m}`;

function prompt(text, sub) {
  return h('div', { class: 'ex-prompt' }, h('h2', {}, text), sub && h('p', { class: 'muted' }, sub));
}

function tokenPinyin(tok) {
  if (WORDS[tok]) return WORDS[tok].p;
  return [...tok].map((c) => WORDS[c]?.p || '').join(' ');
}

/** Exercício genérico de múltipla escolha. */
async function choice(stage, io, { options, correctIdx, onSelect, grid = false }) {
  let sel = -1;
  const btns = options.map((o, i) =>
    h('button', { class: 'opt', onClick: () => select(i) }, h('span', { class: 'opt-k' }, i + 1), h('span', { class: 'opt-label' }, o)));
  function select(i) {
    sel = i;
    btns.forEach((b, j) => b.classList.toggle('sel', j === i));
    sfx.tap();
    onSelect?.(i);
    io.setCheck(true);
  }
  stage.append(h('div', { class: `opts ${grid ? 'grid' : ''}` }, btns));
  io.setCheck(false);
  io.onKey((e) => { const n = +e.key; if (n >= 1 && n <= options.length) select(n - 1); });
  const act = await io.action();
  if (act === 'skip') return { skipped: true };
  btns.forEach((b, j) => { b.disabled = true; if (j === correctIdx) b.classList.add('right'); else if (j === sel) b.classList.add('wrong'); });
  return { correct: sel === correctIdx };
}

// ---------- Tipos ----------
export const EXERCISES = {
  /** Apresenta uma palavra nova. */
  async intro(stage, ex, io) {
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
  },

  /** Hanzi → significado */
  async mc_meaning(stage, ex, io) {
    const w = ex.w;
    stage.append(prompt('O que significa?'), h('div', { class: 'head-row' }, hanziBlock(w), speakers(w.h, { big: false })));
    if (ex.autoplay !== false) speak(w.h);
    const opts = shuffle([w, ...ex.options]);
    const r = await choice(stage, io, { options: opts.map((o) => o.m), correctIdx: opts.indexOf(w) });
    return { ...r, answer: answerHTML(w) };
  },

  /** Significado → hanzi */
  async mc_hanzi(stage, ex, io) {
    const w = ex.w;
    stage.append(prompt(`Como se escreve “${w.m}”?`));
    const opts = shuffle([w, ...ex.options]);
    const r = await choice(stage, io, {
      grid: true,
      options: opts.map((o) => h('span', { class: 'opt-hz' }, h('span', { class: 'hz md' }, o.h), showPy() && h('span', { class: 'py small', html: pinyinHTML(o.p, { join: true }) }))),
      correctIdx: opts.indexOf(w),
      onSelect: (i) => speak(opts[i].h),
    });
    return { ...r, answer: answerHTML(w) };
  },

  /** Áudio → hanzi */
  async listen(stage, ex, io) {
    const w = ex.w;
    stage.append(prompt('O que você ouviu?'), h('div', { class: 'listen-box' }, speakers(w.h)));
    setTimeout(() => speak(w.h), 250);
    const opts = shuffle([w, ...ex.options]);
    const r = await choice(stage, io, {
      grid: true,
      options: opts.map((o) => h('span', { class: 'hz md' }, o.h)),
      correctIdx: opts.indexOf(w),
    });
    return { ...r, answer: answerHTML(w) };
  },

  /** Digitar o pinyin com tons */
  async pinyin(stage, ex, io) {
    const w = ex.w;
    const input = h('input', { class: 'py-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ex.: ni3 hao3', 'aria-label': 'Pinyin' });
    const preview = h('div', { class: 'py-preview' });
    const update = () => {
      preview.innerHTML = /\d/.test(input.value) ? pinyinHTML(input.value.replace(/[^a-züv:0-5 ]/gi, '')) : '&nbsp;';
      io.setCheck(input.value.trim().length > 0);
    };
    input.addEventListener('input', update);
    const insert = (s) => { input.value += s; input.focus(); update(); };
    stage.append(
      prompt('Escreva o pinyin', 'Use números para os tons: 1 ¯  2 ˊ  3 ˇ  4 ˋ (neutro: sem número)'),
      h('div', { class: 'head-row' }, hanziBlock({ ...w, h: w.h }, { pinyin: false, meaning: true }), speakers(w.h, { big: false })),
      h('div', { class: 'py-field' }, input, preview),
      h('div', { class: 'tone-keys' }, [1, 2, 3, 4].map((t) => h('button', { class: `tone-key t${t}`, onClick: () => insert(String(t)) }, markSyllable('a' + t), h('small', {}, t))),
        h('button', { class: 'tone-key', onClick: () => insert('ü') }, 'ü'), h('button', { class: 'tone-key', onClick: () => insert(' ') }, '␣')));
    setTimeout(() => input.focus(), 50);
    io.setCheck(false);
    const act = await io.action();
    if (act === 'skip') return { skipped: true };
    input.disabled = true;
    const r = checkPinyin(input.value, w.p);
    let note = '';
    if (!r.ok && r.lettersOk) note = r.noTones ? 'As letras estão certas — faltaram os tons!' : 'Quase! As letras estão certas, confira os tons.';
    return { correct: r.ok, answer: answerHTML(w), note };
  },

  /** Falar (reconhecimento de voz) */
  async speak(stage, ex, io) {
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
  },

  /** Escrever com ordem de traços */
  async write(stage, ex, io) {
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
  },

  /** Montar frase com peças */
  async build(stage, ex, io) {
    const s = ex.s;
    const tokens = s.t.map((t, i) => ({ t, i }));
    const bank = shuffle([...tokens, ...(ex.distractors || []).map((t, k) => ({ t, i: 100 + k }))]);
    const answer = [];
    const line = h('div', { class: 'build-line' });
    const bankEl = h('div', { class: 'build-bank' });
    const tile = (tok) => h('button', { class: 'tile' },
      h('span', { class: 'hz sm' }, tok.t), showPy() && h('span', { class: 'py tiny', html: pinyinHTML(tokenPinyin(tok.t), { join: true }) }));
    const tiles = new Map(bank.map((tok) => [tok, tile(tok)]));
    const render = () => {
      line.replaceChildren(...answer.map((tok) => tiles.get(tok)));
      bankEl.replaceChildren(...bank.map((tok) => {
        const ph = h('span', { class: 'tile-slot' });
        if (!answer.includes(tok)) ph.append(tiles.get(tok));
        return ph;
      }));
      io.setCheck(answer.length > 0);
    };
    tiles.forEach((el, tok) => (el.onclick = () => {
      if (answer.includes(tok)) answer.splice(answer.indexOf(tok), 1);
      else { answer.push(tok); speak(tok.t); }
      sfx.tap();
      render();
    }));
    if (ex.listen) {
      stage.append(prompt('Monte o que você ouviu'), h('div', { class: 'listen-box' }, speakers(s.plain)));
      setTimeout(() => speak(s.plain), 250);
    } else {
      stage.append(prompt('Traduza para o chinês'), h('div', { class: 'build-source' }, h('span', { class: 'mascot' }, '🐼'), h('div', { class: 'bubble' }, s.m)));
    }
    stage.append(line, bankEl);
    render();
    const act = await io.action();
    if (act === 'skip') return { skipped: true };
    tiles.forEach((el) => (el.disabled = true));
    const ok = answer.map((x) => x.t).join('') === s.plain;
    speak(s.plain);
    return { correct: ok, answer: `<span class="hz-inline">${s.h}</span><br><span class="py-inline">${pinyinHTML(s.p)}</span><br>${s.m}` };
  },

  /** Ligar pares */
  async match(stage, ex, io) {
    const words = ex.words;
    stage.append(prompt('Ligue os pares'));
    const left = shuffle(words), right = shuffle(words);
    let selL = null, selR = null, matched = 0, mistakes = 0;
    let finish;
    const done = new Promise((r) => (finish = r));
    const L = left.map((w) => h('button', { class: 'pair hzp' }, h('span', { class: 'hz md' }, w.h)));
    const R = right.map((w) => h('button', { class: 'pair' }, w.m));
    const check = () => {
      if (!selL || !selR) return;
      const [lb, lw] = selL, [rb, rw] = selR;
      if (lw === rw) {
        lb.classList.add('matched'); rb.classList.add('matched');
        lb.disabled = rb.disabled = true;
        sfx.correct();
        matched++;
        if (matched === words.length) setTimeout(finish, 400);
      } else {
        mistakes++;
        sfx.wrong();
        [lb, rb].forEach((b) => { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 450); });
      }
      lb.classList.remove('sel'); rb.classList.remove('sel');
      selL = selR = null;
    };
    L.forEach((b, i) => (b.onclick = () => { L.forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); selL = [b, left[i]]; speak(left[i].h); check(); }));
    R.forEach((b, i) => (b.onclick = () => { R.forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); selR = [b, right[i]]; sfx.tap(); check(); }));
    stage.append(h('div', { class: 'pairs' }, h('div', { class: 'pair-col' }, L), h('div', { class: 'pair-col' }, R)));
    io.setCheck(false);
    const res = await Promise.race([done.then(() => 'done'), io.action()]);
    if (res === 'skip') return { skipped: true };
    return { correct: mistakes <= 2, silent: mistakes <= 2, note: mistakes ? `${mistakes} erro(s)` : 'Sem erros!' };
  },

  /** Identificar o tom */
  async tone(stage, ex, io) {
    const it = ex.item;
    stage.append(prompt('Qual tom você ouviu?', `Sílaba: ${it.syl}`), h('div', { class: 'listen-box' }, speakers(it.h)));
    setTimeout(() => speak(it.h), 250);
    const r = await choice(stage, io, {
      grid: true,
      options: [1, 2, 3, 4].map((t) => h('span', { class: 'tone-opt', html: `${toneSVG(t)}<b class="t${t}">${markSyllable(it.syl + t)}</b><small>${t}º tom</small>` })),
      correctIdx: it.tone - 1,
    });
    return { ...r, kind: 'tone', answer: `<span class="hz-inline">${it.h}</span> <b class="t${it.tone}">${markSyllable(it.p)}</b> — ${TONE_NAMES[it.tone]}` };
  },
};

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
