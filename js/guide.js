// Guia de estudo exibido dentro do app (versão resumida do METODOLOGIA.md).
import { h } from './util.js';
import { speak } from './audio.js';
import { modal } from './ui.js';

const ROUTINE = [
  ['5 min', '🔁', 'Revisão espaçada', 'Sempre primeiro. Zere as revisões pendentes antes de aprender algo novo.'],
  ['8 min', '📘', 'Uma lição nova', '3–5 palavras novas por dia são suficientes: ~1.000 palavras em 1 ano.'],
  ['4 min', '🎤', 'Fala / shadowing', 'Repita frases junto com o áudio, imitando ritmo e tons.'],
  ['3 min', '🖌️', 'Escrita', 'Escreva os caracteres do dia respeitando a ordem dos traços.'],
  ['+ livre', '🎧', 'Imersão', 'Podcast, série ou música em chinês — mesmo sem entender tudo.'],
];

const PILLARS = [
  ['🎵', 'Tons desde o primeiro dia', 'O tom muda o significado (mā 妈 “mãe” × mǎ 马 “cavalo”). Aprenda cada palavra junto com seu tom e use o Treino e o Espelho de tons.'],
  ['🔁', 'Repetição espaçada', 'Revisar logo antes de esquecer é o jeito mais eficiente de memorizar. Pouco por dia vence muito de vez em quando.'],
  ['🧠', 'Recordação ativa', 'Tentar lembrar (falar, escrever, digitar) fixa muito mais do que reler. Por isso os exercícios pedem que você produza a resposta.'],
  ['🧩', 'Componentes e radicais', 'Caracteres são montados com peças: 好 = 女 (mulher) + 子 (filho). Conhecer ~50 radicais comuns facilita memorizar milhares de caracteres.'],
  ['💬', 'Frases, não palavras soltas', 'Aprenda palavras dentro de frases curtas e úteis. A gramática chinesa entra pelo uso.'],
  ['🎧', 'Muito input compreensível', 'Ouça e leia material um pouco acima do seu nível (i+1). Comece com conteúdo para aprendizes e leituras graduadas.'],
];

const TECHNIQUES = [
  ['Shadowing', 'Ouça uma frase e repita junto, quase ao mesmo tempo, copiando a melodia. Grave-se e compare.'],
  ['Pares de tons', 'Treine palavras de 2 sílabas pelas 20 combinações de tons (ex.: 1-1 飞机, 2-4 学校, 3-3 你好 → ní hǎo).'],
  ['Mnemônicos visuais', 'Crie uma pequena história com os componentes: 休 (descansar) = 人 pessoa encostada numa 木 árvore.'],
  ['Método de Feynman', 'Explique em voz alta, em chinês simples, o que aprendeu hoje — mesmo que sejam 3 frases.'],
  ['Mineração de frases', 'Quando encontrar uma frase útil em série/podcast, anote e transforme em cartão de revisão.'],
  ['Intercalação', 'Misture habilidades na mesma sessão (ouvir, falar, escrever). O app já faz isso nas lições.'],
];

const ROADMAP = [
  ['Mês 1', 'Pinyin, os 4 tons, saudações, números, ~150 palavras. Fale frases do tipo 我是… / 我有…'],
  ['Meses 2–3', '~300 palavras (nível HSK 2 antigo). Perguntas, tempo, compras. Primeiras conversas com tutor ou parceiro de intercâmbio.'],
  ['Meses 4–6', '~600 palavras (HSK 3). Leituras graduadas, séries com legenda em chinês, diário de 3 frases por dia.'],
  ['6–12 meses', '~1.200 palavras (HSK 4). Conversas do dia a dia, podcasts para intermediários, escrita de textos curtos.'],
];

export function guideBody() {
  return h('div', { class: 'guide' },
    h('p', {}, 'O mandarim parece difícil, mas tem vantagens: não há conjugação, gênero, plural nem artigos. As três frentes que exigem mais treino são ',
      h('b', {}, 'tons'), ', ', h('b', {}, 'caracteres'), ' e ', h('b', {}, 'ouvido'), '. Este guia mostra como atacar cada uma.'),

    h('h3', {}, '⏱️ Rotina diária sugerida (≈20 min)'),
    h('div', { class: 'routine' }, ROUTINE.map(([t, i, n, d]) => h('div', { class: 'routine-step' },
      h('span', { class: 'rs-time' }, t), h('span', { class: 'rs-icon' }, i), h('div', {}, h('b', {}, n), h('div', { class: 'muted small' }, d))))),

    h('h3', {}, '🏛️ Os 6 pilares'),
    h('div', { class: 'pillars' }, PILLARS.map(([i, t, d]) => h('div', { class: 'pillar' }, h('span', { class: 'pillar-icon' }, i), h('div', {}, h('b', {}, t), h('p', { class: 'small' }, d))))),

    h('h3', {}, '🎵 Os quatro tons'),
    h('div', { class: 'tones-demo' }, [['妈', 'mā', 'mãe', 1], ['麻', 'má', 'cânhamo', 2], ['马', 'mǎ', 'cavalo', 3], ['骂', 'mà', 'xingar', 4]].map(([c, p, m, t]) =>
      h('button', { class: 'tone-demo', onClick: () => speak(c) }, h('span', { class: 'hz md' }, c), h('b', { class: `t${t}` }, p), h('small', {}, m)))),
    h('p', { class: 'small muted' }, 'Toque para ouvir. Cores dos tons no app: 1º vermelho, 2º laranja, 3º verde, 4º azul, neutro cinza.'),
    h('p', { class: 'small' }, h('b', {}, 'Regras de mudança de tom (sandhi): '), '3º + 3º → o primeiro vira 2º (你好 = ní hǎo). 不 vira bú antes de 4º tom (不客气 = bú kèqi). 一 vira yí antes de 4º tom e yì antes dos outros. O app mostra a forma de dicionário, mas aceita as duas ao digitar.'),

    h('h3', {}, '🛠️ Técnicas que funcionam'),
    h('ul', { class: 'tech-list' }, TECHNIQUES.map(([t, d]) => h('li', {}, h('b', {}, t + ': '), d))),

    h('h3', {}, '🗺️ Roteiro de evolução'),
    h('div', { class: 'roadmap' }, ROADMAP.map(([t, d]) => h('div', { class: 'rm-step' }, h('b', {}, t), h('span', { class: 'small' }, d)))),

    h('h3', {}, '✅ Hábitos de quem chega longe'),
    h('ul', { class: 'tech-list' },
      h('li', {}, 'Estude todo dia, mesmo que 5 minutos: a ofensiva 🔥 existe para isso.'),
      h('li', {}, 'Fale em voz alta desde a primeira semana — vergonha é o maior obstáculo.'),
      h('li', {}, 'Desligue o pinyin (Perfil → Configurações) assim que reconhecer os caracteres.'),
      h('li', {}, 'Grave sua voz uma vez por mês lendo o mesmo texto e compare a evolução.'),
      h('li', {}, 'A partir do 2º mês, converse 30 min por semana com um nativo (tutor ou intercâmbio).')));
}

export function openGuide() {
  modal({ title: '📖 Guia de estudo', body: guideBody(), className: 'guide-modal', actions: [{ label: 'Bora estudar!', value: true }] });
}
