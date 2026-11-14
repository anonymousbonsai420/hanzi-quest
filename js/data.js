// Conteúdo do curso: vocabulário básico (base HSK 1) organizado em unidades temáticas.
// Pinyin em formato numérico: tom 1–4, 5 = tom neutro. "v" = ü.
// Formas de citação (sem sandhi); o verificador aceita as variações de sandhi.

const RAW = [
  {
    id: 'u1', zh: '问候', title: 'Saudações', icon: '👋', color: '#d62839',
    tip: 'Para transformar uma afirmação em pergunta de sim/não, basta colocar 吗 (ma) no final: 你好 → 你好吗？ Não existe conjugação verbal, nem artigos, nem gênero gramatical!',
    words: [
      ['你好', 'ni3 hao3', 'olá'],
      ['好', 'hao3', 'bom; bem'],
      ['吗', 'ma5', '(partícula de pergunta)'],
      ['谢谢', 'xie4 xie5', 'obrigado(a)'],
      ['不客气', 'bu4 ke4 qi5', 'de nada'],
      ['再见', 'zai4 jian4', 'tchau; até logo'],
      ['对不起', 'dui4 bu5 qi3', 'desculpe'],
      ['没关系', 'mei2 guan1 xi5', 'não tem problema'],
    ],
    sentences: [
      { t: ['你', '好', '吗'], end: '？', p: 'ni3 hao3 ma5', m: 'Tudo bem com você?' },
      { t: ['谢谢', '你'], end: '！', p: 'xie4xie5 ni3', m: 'Obrigado a você!' },
    ],
  },
  {
    id: 'u2', zh: '人', title: 'Pessoas', icon: '🧑', color: '#e07a1f',
    tip: '们 (men) forma o plural de pronomes: 我 → 我们. 他 (ele) e 她 (ela) têm a MESMA pronúncia: tā. A ordem básica é Sujeito + Verbo + Objeto, como no português: 我是学生.',
    words: [
      ['我', 'wo3', 'eu'],
      ['你', 'ni3', 'você'],
      ['他', 'ta1', 'ele'],
      ['她', 'ta1', 'ela'],
      ['我们', 'wo3 men5', 'nós'],
      ['是', 'shi4', 'ser; é'],
      ['人', 'ren2', 'pessoa'],
      ['老师', 'lao3 shi1', 'professor(a)'],
      ['学生', 'xue2 sheng5', 'estudante'],
      ['朋友', 'peng2 you5', 'amigo(a)'],
      ['叫', 'jiao4', 'chamar(-se)'],
      ['什么', 'shen2 me5', 'o quê; qual'],
      ['名字', 'ming2 zi5', 'nome'],
    ],
    sentences: [
      { t: ['我', '是', '学生'], p: 'wo3 shi4 xue2sheng5', m: 'Eu sou estudante.' },
      { t: ['她', '是', '老师'], p: 'ta1 shi4 lao3shi1', m: 'Ela é professora.' },
      { t: ['他', '是', '我', '朋友'], p: 'ta1 shi4 wo3 peng2you5', m: 'Ele é meu amigo.' },
      { t: ['你', '叫', '什么', '名字'], end: '？', p: 'ni3 jiao4 shen2me5 ming2zi5', m: 'Qual é o seu nome?' },
      { t: ['我们', '是', '朋友'], p: 'wo3men5 shi4 peng2you5', m: 'Nós somos amigos.' },
    ],
  },
  {
    id: 'u3', zh: '数字', title: 'Números', icon: '🔢', color: '#c99a06',
    tip: 'Os números de 11 a 99 são lógicos: 十一 (10+1) = 11, 二十 (2×10) = 20, 九十九 = 99. Para contar coisas usa-se um classificador entre o número e o substantivo: 三个人 (três pessoas).',
    words: [
      ['一', 'yi1', 'um (1)'],
      ['二', 'er4', 'dois (2)'],
      ['三', 'san1', 'três (3)'],
      ['四', 'si4', 'quatro (4)'],
      ['五', 'wu3', 'cinco (5)'],
      ['六', 'liu4', 'seis (6)'],
      ['七', 'qi1', 'sete (7)'],
      ['八', 'ba1', 'oito (8)'],
      ['九', 'jiu3', 'nove (9)'],
      ['十', 'shi2', 'dez (10)'],
      ['个', 'ge4', '(classificador geral)'],
      ['几', 'ji3', 'quantos? (pouca quantidade)'],
      ['岁', 'sui4', 'anos (de idade)'],
    ],
    sentences: [
      { t: ['你', '几', '岁'], end: '？', p: 'ni3 ji3 sui4', m: 'Quantos anos você tem?' },
      { t: ['我', '十八', '岁'], p: 'wo3 shi2ba1 sui4', m: 'Eu tenho dezoito anos.' },
      { t: ['三', '个', '人'], p: 'san1 ge4 ren2', m: 'Três pessoas.' },
    ],
  },
  {
    id: 'u4', zh: '家', title: 'Família', icon: '🏠', color: '#2b9348',
    tip: '的 (de) indica posse: 我的猫 = meu gato. Com família e pessoas próximas o 的 pode cair: 我妈妈. A negação de 有 é sempre 没有 — nunca 不有.',
    words: [
      ['家', 'jia1', 'casa; família'],
      ['爸爸', 'ba4 ba5', 'pai'],
      ['妈妈', 'ma1 ma5', 'mãe'],
      ['儿子', 'er2 zi5', 'filho'],
      ['女儿', 'nv3 er2', 'filha'],
      ['有', 'you3', 'ter; haver'],
      ['没有', 'mei2 you3', 'não ter'],
      ['的', 'de5', '(partícula de posse)'],
      ['爱', 'ai4', 'amar'],
      ['这', 'zhe4', 'este; isto'],
      ['那', 'na4', 'aquele; aquilo'],
      ['狗', 'gou3', 'cachorro'],
      ['猫', 'mao1', 'gato'],
    ],
    sentences: [
      { t: ['我', '爱', '我', '的', '妈妈'], p: 'wo3 ai4 wo3 de5 ma1ma5', m: 'Eu amo a minha mãe.' },
      { t: ['我', '有', '一', '个', '儿子'], p: 'wo3 you3 yi1 ge4 er2zi5', m: 'Eu tenho um filho.' },
      { t: ['这', '是', '我', '的', '猫'], p: 'zhe4 shi4 wo3 de5 mao1', m: 'Este é o meu gato.' },
      { t: ['他', '没有', '狗'], p: 'ta1 mei2you3 gou3', m: 'Ele não tem cachorro.' },
      { t: ['那', '是', '我', '爸爸'], p: 'na4 shi4 wo3 ba4ba5', m: 'Aquele é o meu pai.' },
    ],
  },
  {
    id: 'u5', zh: '吃喝', title: 'Comida', icon: '🍜', color: '#1b8a8f',
    tip: 'Adjetivos funcionam como verbos: 苹果很好吃 = "a maçã (é) muito gostosa" — não se usa 是 antes de adjetivos. O 很 muitas vezes é só um "conector" e não significa "muito" com força.',
    words: [
      ['吃', 'chi1', 'comer'],
      ['喝', 'he1', 'beber'],
      ['水', 'shui3', 'água'],
      ['茶', 'cha2', 'chá'],
      ['米饭', 'mi3 fan4', 'arroz (cozido)'],
      ['菜', 'cai4', 'prato; verdura'],
      ['苹果', 'ping2 guo3', 'maçã'],
      ['喜欢', 'xi3 huan5', 'gostar'],
      ['想', 'xiang3', 'querer; pensar'],
      ['不', 'bu4', 'não'],
      ['很', 'hen3', 'muito'],
      ['好吃', 'hao3 chi1', 'gostoso'],
    ],
    sentences: [
      { t: ['我', '喜欢', '喝', '茶'], p: 'wo3 xi3huan5 he1 cha2', m: 'Eu gosto de beber chá.' },
      { t: ['我', '想', '吃', '米饭'], p: 'wo3 xiang3 chi1 mi3fan4', m: 'Eu quero comer arroz.' },
      { t: ['苹果', '很', '好吃'], p: 'ping2guo3 hen3 hao3chi1', m: 'A maçã é muito gostosa.' },
      { t: ['你', '喝', '水', '吗'], end: '？', p: 'ni3 he1 shui3 ma5', m: 'Você bebe água?' },
      { t: ['我', '不', '喜欢', '吃', '菜'], p: 'wo3 bu4 xi3huan5 chi1 cai4', m: 'Eu não gosto de comer verduras.' },
    ],
  },
  {
    id: 'u6', zh: '时间', title: 'Tempo', icon: '🕒', color: '#2f6fdf',
    tip: 'O tempo vai do maior para o menor: ano → mês → dia → hora (2026年11月14日). Os dias da semana são numerados: 星期一 = segunda, 星期二 = terça… e domingo é 星期天. Expressões de tempo vêm antes do verbo.',
    words: [
      ['今天', 'jin1 tian1', 'hoje'],
      ['明天', 'ming2 tian1', 'amanhã'],
      ['昨天', 'zuo2 tian1', 'ontem'],
      ['现在', 'xian4 zai4', 'agora'],
      ['年', 'nian2', 'ano'],
      ['月', 'yue4', 'mês; lua'],
      ['日', 'ri4', 'dia; sol'],
      ['星期', 'xing1 qi1', 'semana'],
      ['点', 'dian3', 'hora (em ponto)'],
      ['上午', 'shang4 wu3', 'manhã'],
      ['下午', 'xia4 wu3', 'tarde'],
    ],
    sentences: [
      { t: ['今天', '星期', '一'], p: 'jin1tian1 xing1qi1 yi1', m: 'Hoje é segunda-feira.' },
      { t: ['现在', '几', '点'], end: '？', p: 'xian4zai4 ji3 dian3', m: 'Que horas são agora?' },
      { t: ['昨天', '是', '星期', '五'], p: 'zuo2tian1 shi4 xing1qi1 wu3', m: 'Ontem foi sexta-feira.' },
      { t: ['现在', '下午', '三', '点'], p: 'xian4zai4 xia4wu3 san1 dian3', m: 'Agora são três da tarde.' },
    ],
  },
  {
    id: 'u7', zh: '地方', title: 'Lugares', icon: '🗺️', color: '#7c4ddb',
    tip: 'Perguntas mantêm a ordem da afirmação: 你去哪儿？(você vai onde?) → 我去学校 (eu vou [à] escola). Basta trocar a palavra interrogativa pela resposta. País + 人 = nacionalidade: 巴西人, 中国人.',
    words: [
      ['去', 'qu4', 'ir'],
      ['来', 'lai2', 'vir'],
      ['在', 'zai4', 'estar em; em'],
      ['哪儿', 'nar3', 'onde'],
      ['学校', 'xue2 xiao4', 'escola'],
      ['中国', 'zhong1 guo2', 'China'],
      ['巴西', 'ba1 xi1', 'Brasil'],
      ['商店', 'shang1 dian4', 'loja'],
      ['医院', 'yi1 yuan4', 'hospital'],
      ['饭店', 'fan4 dian4', 'restaurante; hotel'],
      ['住', 'zhu4', 'morar'],
    ],
    sentences: [
      { t: ['你', '去', '哪儿'], end: '？', p: 'ni3 qu4 nar3', m: 'Aonde você vai?' },
      { t: ['我', '在', '学校'], p: 'wo3 zai4 xue2xiao4', m: 'Eu estou na escola.' },
      { t: ['我', '是', '巴西', '人'], p: 'wo3 shi4 ba1xi1 ren2', m: 'Eu sou brasileiro(a).' },
      { t: ['他', '住', '在', '中国'], p: 'ta1 zhu4 zai4 zhong1guo2', m: 'Ele mora na China.' },
      { t: ['明天', '我', '去', '商店'], p: 'ming2tian1 wo3 qu4 shang1dian4', m: 'Amanhã eu vou à loja.' },
    ],
  },
  {
    id: 'u8', zh: '交流', title: 'Conversa', icon: '💬', color: '#b5179e',
    tip: '呢 (ne) "devolve" a pergunta: 我很好，你呢？= "Estou bem, e você?". 会 indica uma habilidade aprendida: 我会说汉语 = Eu sei falar chinês.',
    words: [
      ['谁', 'shei2', 'quem'],
      ['哪', 'na3', 'qual'],
      ['多少', 'duo1 shao5', 'quanto(s)'],
      ['钱', 'qian2', 'dinheiro'],
      ['块', 'kuai4', 'yuan (moeda, coloquial)'],
      ['怎么', 'zen3 me5', 'como'],
      ['说', 'shuo1', 'falar'],
      ['汉语', 'han4 yu3', 'língua chinesa'],
      ['会', 'hui4', 'saber (fazer)'],
      ['呢', 'ne5', 'e (você)?'],
      ['认识', 'ren4 shi5', 'conhecer'],
      ['高兴', 'gao1 xing4', 'feliz; contente'],
    ],
    sentences: [
      { t: ['你', '会', '说', '汉语', '吗'], end: '？', p: 'ni3 hui4 shuo1 han4yu3 ma5', m: 'Você sabe falar chinês?' },
      { t: ['这', '个', '多少', '钱'], end: '？', p: 'zhe4 ge4 duo1shao5 qian2', m: 'Quanto custa isto?' },
      { t: ['认识', '你', '很', '高兴'], p: 'ren4shi5 ni3 hen3 gao1xing4', m: 'Prazer em conhecer você.' },
      { t: ['他', '是', '谁'], end: '？', p: 'ta1 shi4 shei2', m: 'Quem é ele?' },
      { t: ['我', '很', '好', '你', '呢'], end: '？', p: 'wo3 hen3 hao3 ni3 ne5', m: 'Estou bem, e você?' },
    ],
  },
];

export const UNITS = RAW.map((u, index) => ({
  ...u,
  index,
  words: u.words.map(([h, p, m]) => ({ id: h, h, p, m, unit: u.id })),
  sentences: u.sentences.map((s, i) => ({
    id: `${u.id}-s${i}`,
    t: s.t,
    plain: s.t.join(''),
    h: s.t.join('') + (s.end || '。'),
    p: s.p,
    m: s.m,
    unit: u.id,
  })),
}));

export const WORDS = {};
UNITS.forEach((u) => u.words.forEach((w) => (WORDS[w.id] = w)));
export const ALL_WORDS = Object.values(WORDS);
export const ALL_SENTENCES = UNITS.flatMap((u) => u.sentences);
export const unitById = (id) => UNITS.find((u) => u.id === id);

/** Divide as palavras da unidade em lições de ~4 palavras + uma lição de consolidação. */
export function lessonsOf(unit) {
  const n = unit.words.length;
  const k = Math.ceil(n / 4);
  const base = Math.floor(n / k), extra = n % k;
  const lessons = [];
  let i = 0;
  for (let j = 0; j < k; j++) {
    const size = base + (j < extra ? 1 : 0);
    lessons.push({ idx: j, kind: 'learn', words: unit.words.slice(i, i + size), name: `Lição ${j + 1}` });
    i += size;
  }
  lessons.push({ idx: k, kind: 'consolidate', words: unit.words, name: 'Desafio da unidade' });
  return lessons;
}

// Conjuntos para treino de tons: [sílaba, [tom1, tom2, tom3, tom4]]
export const TONE_SETS = [
  ['ma', ['妈', '麻', '马', '骂']],
  ['ba', ['八', '拔', '把', '爸']],
  ['yi', ['衣', '姨', '椅', '意']],
  ['wu', ['屋', '无', '五', '物']],
  ['tang', ['汤', '糖', '躺', '烫']],
  ['shi', ['诗', '十', '使', '是']],
  ['tong', ['通', '同', '统', '痛']],
  ['fen', ['分', '坟', '粉', '份']],
  ['guo', ['锅', '国', '果', '过']],
  ['zhu', ['猪', '竹', '主', '住']],
  ['tu', ['秃', '图', '土', '兔']],
  ['shu', ['书', '熟', '鼠', '树']],
  ['qi', ['七', '骑', '起', '气']],
  ['hua', ['花', '滑', null, '画']],
  ['mai', [null, '埋', '买', '卖']],
  ['tian', ['天', '甜', '舔', null]],
];
export const TONE_ITEMS = TONE_SETS.flatMap(([syl, chars]) =>
  chars.map((h, i) => (h ? { h, syl, tone: i + 1, p: `${syl}${i + 1}` } : null)).filter(Boolean)
);
