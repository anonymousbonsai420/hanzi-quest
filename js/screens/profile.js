// Tela Perfil: nível, estatísticas, atividade, conquistas, loja e configurações.
import { h } from '../lib/dom.js';
import { todayKey } from '../lib/time.js';
import { modal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { heatmap } from '../ui/heatmap.js';
import { state, save, resetAll, exportData, importData } from '../state.js';
import { levelInfo, ACHIEVEMENTS, buy, PRICES, HEART_MAX } from '../game.js';
import { speak, voiceName, hasChineseVoice, ttsSupported } from '../audio.js';
import { asrSupported } from '../speech.js';
import { rerender } from './rerender.js';
import { applyTheme } from '../theme.js';
import { openGuide } from '../guide.js';

export function renderProfile(view) {
  const lv = levelInfo();
  const learned = Object.keys(state.srs).length;
  const total = state.stats.correct + state.stats.wrong;
  const acc = total ? Math.round((state.stats.correct / total) * 100) : 0;

  view.append(
    h('div', { class: 'card profile-head' },
      h('div', { class: 'avatar' }, '🐼'),
      h('div', { class: 'grow' },
        h('div', { class: 'lvl' }, `Nível ${lv.level} · `, h('span', { class: 'hz-inline' }, lv.zh), ` ${lv.pt}`),
        h('div', { class: 'meter' }, h('div', { class: 'gold-fill', style: { width: `${lv.pct * 100}%` } })),
        h('div', { class: 'muted small' }, `${state.xp} XP · faltam ${lv.next - state.xp} XP para o nível ${lv.level + 1}`))),
    h('button', { class: 'card guide-cta', onClick: openGuide },
      h('span', { class: 'pt-icon' }, '📖'),
      h('div', {}, h('div', { class: 'card-title' }, 'Guia de estudo'), h('div', { class: 'muted small' }, 'Métodos comprovados e uma rotina diária para evoluir no mandarim.')),
      h('span', {}, '›')),
    h('div', { class: 'stat-grid' },
      stat('🔥', state.streak, 'Ofensiva atual'),
      stat('🏆', state.bestStreak, 'Melhor ofensiva'),
      stat('📚', learned, 'Palavras'),
      stat('🎯', `${acc}%`, 'Precisão'),
      stat('🎤', state.stats.speakOk, 'Falas certas'),
      stat('🖌️', state.stats.writeOk, 'Escritas certas'),
      stat('🎵', state.stats.toneOk, 'Tons certos'),
      stat('⏱️', `${state.stats.minutes}m`, 'Tempo de estudo')),
    h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Atividade (12 semanas)'), heatmap(state.days)),
    h('div', { class: 'card' },
      h('div', { class: 'card-title' }, `Conquistas · ${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}`),
      h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map((a) => h('div', { class: `ach ${state.achievements[a.id] ? 'got' : ''}`, title: a.desc },
        h('span', { class: 'ach-icon' }, a.icon), h('b', {}, a.name), h('small', {}, a.desc))))),
    shopCard(),
    settingsCard());
}
const stat = (icon, v, label) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, icon, ' ', v), h('div', { class: 'stat-l' }, label));

function shopCard() {
  const item = (icon, name, desc, price, key, disabled) => h('div', { class: 'shop-item' },
    h('span', { class: 'shop-icon' }, icon),
    h('div', { class: 'grow' }, h('b', {}, name), h('div', { class: 'muted small' }, desc)),
    h('button', {
      class: 'btn gold small', disabled: disabled || state.coins < price,
      onClick: () => { if (buy(key)) { toast(`${name} comprado!`, { icon }); rerender(); } },
    }, `${price} 💰`));
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, `Loja · você tem ${state.coins} 💰`),
    item('🧊', 'Congelar ofensiva', `Protege sua ofensiva se você faltar um dia (${state.freezes}/2 equipados).`, PRICES.freeze, 'freeze', state.freezes >= 2),
    item('❤️', 'Recarregar vidas', `Volta para ${HEART_MAX} vidas.`, PRICES.refill, 'refill', state.hearts >= HEART_MAX),
    item('💗', '+1 vida', 'Uma vida extra agora.', PRICES.heart, 'heart', state.hearts >= HEART_MAX));
}

function settingsCard() {
  const s = state.settings;
  const toggle = (key, label, desc) => h('label', { class: 'setting' },
    h('div', { class: 'grow' }, h('b', {}, label), desc && h('div', { class: 'muted small' }, desc)),
    h('input', { type: 'checkbox', class: 'switch', checked: s[key], onChange: (e) => { s[key] = e.target.checked; save(); if (key === 'theme') applyTheme(); } }));
  const goalSel = h('select', { onChange: (e) => { state.dailyGoal = +e.target.value; save(); rerender(); } },
    [[10, 'Casual · 10 XP'], [20, 'Regular · 20 XP'], [30, 'Sério · 30 XP'], [50, 'Intenso · 50 XP']].map(([v, l]) => h('option', { value: v, selected: state.dailyGoal === v }, l)));
  const themeSel = h('select', { onChange: (e) => { s.theme = e.target.value; save(); applyTheme(); } },
    [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => h('option', { value: v, selected: s.theme === v }, l)));
  const rate = h('input', { type: 'range', min: 0.5, max: 1.2, step: 0.05, value: s.ttsRate, onChange: (e) => { s.ttsRate = +e.target.value; save(); speak('你好，我是你的老师。'); } });
  const fileIn = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onChange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { importData(await f.text()); toast('Progresso importado!', { icon: '✅' }); rerender(); } catch { toast('Arquivo inválido.', { icon: '⚠️' }); }
  } });
  return h('div', { class: 'card settings' },
    h('div', { class: 'card-title' }, '⚙️ Configurações'),
    h('label', { class: 'setting' }, h('div', { class: 'grow' }, h('b', {}, 'Meta diária')), goalSel),
    toggle('showPinyin', 'Mostrar pinyin', 'Desative quando quiser treinar a leitura só dos caracteres.'),
    toggle('speaking', 'Exercícios de fala', asrSupported ? 'Reconhecimento de voz disponível ✓' : 'Sem reconhecimento de voz neste navegador (Chrome/Edge recomendados).'),
    toggle('writing', 'Exercícios de escrita'),
    toggle('sound', 'Efeitos sonoros'),
    h('label', { class: 'setting' }, h('div', { class: 'grow' }, h('b', {}, 'Velocidade da voz'), h('div', { class: 'muted small' }, ttsSupported ? (hasChineseVoice() ? `Voz: ${voiceName()}` : '⚠️ Nenhuma voz chinesa instalada — instale o pacote de idioma Chinês (Simplificado) no sistema.') : 'Síntese de voz indisponível.')), rate),
    h('label', { class: 'setting' }, h('div', { class: 'grow' }, h('b', {}, 'Tema')), themeSel),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost small', onClick: () => speak('你好！欢迎学习汉语。') }, '🔊 Testar voz'),
      h('button', { class: 'btn ghost small', onClick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([exportData()], { type: 'application/json' })), download: `hanzi-quest-${todayKey()}.json` });
        a.click();
      } }, '💾 Exportar progresso'),
      h('button', { class: 'btn ghost small', onClick: () => fileIn.click() }, '📂 Importar'), fileIn,
      h('button', { class: 'btn danger small', onClick: async () => {
        const ok = await modal({ title: 'Apagar todo o progresso?', body: 'Isso não pode ser desfeito.', actions: [{ label: 'Cancelar', value: false, class: 'ghost' }, { label: 'Apagar', value: true, class: 'danger' }] });
        if (ok) resetAll();
      } }, '🗑️ Reiniciar')));
}
