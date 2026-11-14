// Boas-vindas no primeiro acesso: meta diária e checagem de voz, microfone e escrita.
import { h } from '../util.js';
import { state, save } from '../state.js';
import { speak, hasChineseVoice } from '../audio.js';
import { asrSupported } from '../speech.js';
import { writerAvailable } from '../writer.js';
import { modal } from '../ui.js';

export async function onboarding() {
  const goal = await modal({
    className: 'onboard',
    dismissable: false,
    body: h('div', { class: 'center' },
      h('div', { class: 'logo-big' }, '汉字之旅'),
      h('h2', {}, 'Bem-vindo ao Hanzi Quest!'),
      h('p', {}, 'Aprenda mandarim com lições curtas, repetição espaçada, reconhecimento de fala e escrita dos caracteres traço a traço.'),
      h('p', { class: 'muted' }, 'Quanto tempo você quer estudar por dia?')),
    actions: [
      { label: '🌱 Casual · 5 min', value: 10, class: 'ghost' },
      { label: '📘 Regular · 10 min', value: 20, class: 'green' },
      { label: '🔥 Sério · 15 min', value: 30, class: 'ghost' },
      { label: '🐉 Intenso · 25 min', value: 50, class: 'ghost' },
    ],
  });
  state.dailyGoal = goal || 20;
  state.onboarded = true;
  save();
  await modal({
    title: 'Antes de começar',
    body: h('div', {},
      h('ul', { class: 'check-list' },
        h('li', {}, hasChineseVoice() ? '✅ Voz em mandarim encontrada.' : '⚠️ Nenhuma voz chinesa detectada. No Windows: Configurações → Hora e idioma → Fala → adicionar "Chinês (Simplificado)". No Edge/Chrome online geralmente já existe.'),
        h('li', {}, asrSupported ? '✅ Reconhecimento de fala disponível (precisa de internet e permissão de microfone).' : '⚠️ Seu navegador não reconhece fala. Use Chrome ou Edge para exercícios de pronúncia com correção.'),
        h('li', {}, writerAvailable() ? '✅ Escrita de caracteres pronta.' : '⚠️ Escrita precisa de internet para carregar os traços.')),
      h('p', {}, 'Dica: comece pela 1ª unidade e faça a revisão diária. Leia o 📖 Guia de estudo no Perfil quando puder.'),
      h('button', { class: 'btn ghost small', onClick: () => speak('你好！') }, '🔊 Testar áudio')),
    actions: [{ label: 'Começar! 加油！', value: true, class: 'green' }],
    dismissable: false,
  });
}
