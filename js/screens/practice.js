// Tela Praticar: treinos livres (tons, fala, escrita, escuta, pinyin, relâmpago).
import { h } from '../util.js';
import { state } from '../state.js';
import { buildTones, buildSpeaking, buildWriting, buildPinyin, buildListening } from '../builder.js';
import { asrSupported, recordSupported } from '../speech.js';
import { writerAvailable } from '../writer.js';
import { runSession } from '../session/runner.js';
import { runSpeed } from '../session/speed.js';
import { runToneMirror } from '../session/tone-mirror.js';
import { rerender } from './rerender.js';

export function renderPractice(view) {
  const tiles = [
    { icon: '🎵', title: 'Treino de tons', desc: 'Ouça e identifique o tom de cada sílaba.', color: 'red', run: () => runSession({ kind: 'practice', title: 'Treino de tons', items: buildTones(10), srsMode: 'none' }) },
    { icon: '📈', title: 'Espelho de tons', desc: 'Veja a curva da sua voz sobre o contorno correto.', color: 'purple', run: runToneMirror, needs: 'mic' },
    { icon: '🎤', title: 'Laboratório de fala', desc: 'Pronuncie palavras e frases com correção automática.', color: 'jade', run: () => runSession({ kind: 'practice', title: 'Fala', items: buildSpeaking(8), srsMode: 'existing' }), needs: 'asr' },
    { icon: '🖌️', title: 'Caligrafia', desc: 'Escreva caracteres respeitando a ordem dos traços.', color: 'gold', run: () => runSession({ kind: 'practice', title: 'Caligrafia', items: buildWriting(6), srsMode: 'existing' }), needs: 'writer' },
    { icon: '🎧', title: 'Escuta e ditado', desc: 'Reconheça palavras e monte frases pelo áudio.', color: 'blue', run: () => runSession({ kind: 'practice', title: 'Escuta', items: buildListening(8), srsMode: 'existing' }) },
    { icon: '⌨️', title: 'Pinyin e tons', desc: 'Digite o pinyin com os tons corretos.', color: 'teal', run: () => runSession({ kind: 'practice', title: 'Pinyin', items: buildPinyin(8), srsMode: 'existing' }) },
    { icon: '⚡', title: 'Desafio relâmpago', desc: `60 segundos, o máximo de acertos. Recorde: ${state.stats.bestSpeed}`, color: 'orange', run: runSpeed },
  ];
  const warn = (n) => (n === 'asr' && !asrSupported ? 'Sem reconhecimento de fala neste navegador — modo gravar e comparar.' : n === 'writer' && !writerAvailable() ? 'Requer internet para carregar os traços.' : n === 'mic' && !recordSupported ? 'Microfone indisponível.' : null);
  view.append(
    h('h1', { class: 'page-title' }, '🎯 Praticar'),
    h('p', { class: 'muted' }, 'Treinos não gastam vidas e rendem XP. Use as palavras que você já aprendeu.'),
    h('div', { class: 'practice-grid' }, tiles.map((t) => h('button', {
      class: `practice-tile ${t.color}`,
      onClick: async () => { await t.run(); rerender(); },
    }, h('span', { class: 'pt-icon' }, t.icon), h('span', { class: 'pt-title' }, t.title), h('span', { class: 'pt-desc' }, t.desc),
    warn(t.needs) && h('span', { class: 'pt-warn' }, warn(t.needs))))));
}
