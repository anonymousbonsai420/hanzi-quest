// Reconhecimento de fala (Web Speech API, zh-CN) e avaliação da pronúncia.
import { ALL_WORDS, ALL_SENTENCES, TONE_ITEMS } from './data.js';
import { syllables, toneless } from './pinyin.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const asrSupported = !!SR;
export const recordSupported = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

// ---------- Mapa caractere → leituras (sem tom) para tolerar homófonos ----------
const READINGS = {};
function addReading(ch, r) { (READINGS[ch] ??= new Set()).add(r); }
function addWord(h, p) {
  const chars = [...h];
  const syls = syllables(p);
  if (chars.length === syls.length) chars.forEach((c, i) => addReading(c, toneless(syls[i])));
}
ALL_WORDS.forEach((w) => addWord(w.h, w.p));
ALL_SENTENCES.forEach((s) => addWord(s.plain, s.p));
TONE_ITEMS.forEach((t) => addReading(t.h, t.syl));
// Homófonos comuns que o reconhecedor costuma devolver
const EXTRA = `吧ba 巴ba 疤ba 它ta 塔ta 踏ta 嘛ma 码ma 蚂ma 得de 地de 再zai 载zai 事shi 时shi 石shi 实shi 市shi 式shi 世shi 视shi 试shi 师shi 诗shi
 尼ni 泥ni 拟ni 腻ni 那na 拿na 纳na 以yi 已yi 医yi 亿yi 义yi 易yi 依yi 议yi 艺yi 忆yi 午wu 舞wu 务wu 误wu 武wu 屋wu 吾wu 雾wu
 酒jiu 久jiu 就jiu 旧jiu 救jiu 期qi 其qi 奇qi 器qi 汽qi 妻qi 起qi 气qi 骑qi 散san 伞san 死si 思si 斯si 寺si 丝si 私si 似si 司si
 流liu 留liu 刘liu 柳liu 而er 耳er 尔er 握wo 卧wo 窝wo 号hao 毫hao 豪hao 浩hao 和he 合he 河he 何he 贺he 盒he 核he 迟chi 尺chi 池chi 持chi
 睡shui 税shui 谁shui 查cha 差cha 插cha 察cha 他ta 她ta 妈ma 马ma 麻ma 骂ma 门men 闷men 们men 嗯en 恩en 呃e 额e 哦o 喔o 你ni
 进jin 金jin 近jin 斤jin 天tian 添tian 田tian 名ming 明ming 鸣ming 字zi 子zi 自zi 紫zi 资zi 老lao 劳lao 牢lao 学xue 雪xue 血xue 生sheng 声sheng 升sheng
 朋peng 碰peng 鹏peng 友you 有you 又you 由you 油you 游you 右you 叫jiao 教jiao 较jiao 交jiao 焦jiao 什shen 身shen 深shen 神shen 么me 没mei 美mei 每mei 妹mei
 关guan 管guan 观guan 馆guan 系xi 西xi 洗xi 喜xi 细xi 戏xi 息xi 习xi 起qi 对dui 队dui 不bu 布bu 步bu 部bu 客ke 可ke 课ke 刻ke 克ke 谢xie 写xie 些xie 鞋xie
 见jian 件jian 间jian 建jian 健jian 剑jian 好hao 欢huan 换huan 环huan 还huan 想xiang 像xiang 向xiang 象xiang 香xiang 很hen 恨hen 狠hen 吃chi 喝he 水shui 茶cha
 饭fan 反fan 范fan 犯fan 翻fan 菜cai 才cai 彩cai 财cai 材cai 苹ping 平ping 评ping 瓶ping 果guo 过guo 国guo 锅guo 家jia 加jia 佳jia 假jia 价jia 爸ba 八ba 把ba
 儿er 二er 子zi 女nv 有you 的de 爱ai 碍ai 哎ai 这zhe 着zhe 者zhe 那na 哪na 狗gou 够gou 购gou 构gou 猫mao 毛mao 帽mao 冒mao 贸mao 今jin 明ming 昨zuo 做zuo 作zuo 坐zuo 座zuo
 现xian 先xian 线xian 县xian 限xian 在zai 年nian 念nian 月yue 越yue 约yue 乐yue 日ri 星xing 兴xing 行xing 姓xing 醒xing 期qi 点dian 店dian 电dian 典dian
 上shang 尚shang 伤shang 商shang 下xia 夏xia 吓xia 虾xia 午wu 去qu 区qu 取qu 趣qu 来lai 莱lai 赖lai 校xiao 小xiao 笑xiao 效xiao 中zhong 种zhong 重zhong 钟zhong 终zhong
 医yi 院yuan 原yuan 元yuan 远yuan 愿yuan 员yuan 园yuan 住zhu 主zhu 注zhu 助zhu 祝zhu 著zhu 谁shei 多duo 都dou 少shao 烧shao 钱qian 前qian 千qian 浅qian 欠qian
 块kuai 快kuai 筷kuai 会hui 回hui 汇hui 惠hui 怎zen 说shuo 硕shuo 汉han 喊han 寒han 含han 语yu 雨yu 鱼yu 与yu 于yu 余yu 宇yu 呢ne 认ren 人ren 任ren 仁ren 忍ren
 识shi 高gao 告gao 稿gao 糕gao 岁sui 碎sui 随sui 虽sui 个ge 各ge 歌ge 哥ge 格ge 几ji 机ji 鸡ji 级ji 记ji 极ji 及ji 计ji 七qi 九jiu 六liu 十shi 四si 三san 五wu 一yi`;
EXTRA.split(/\s+/).filter(Boolean).forEach((tok) => addReading(tok[0], tok.slice(1)));

function sameSound(a, b) {
  if (a === b) return true;
  const ra = READINGS[a], rb = READINGS[b];
  if (!ra || !rb) return false;
  for (const r of ra) if (rb.has(r)) return true;
  return false;
}

// ---------- Normalização ----------
const DIGITS = '零一二三四五六七八九';
function numToZh(n) {
  if (n < 10) return DIGITS[n];
  if (n < 20) return '十' + (n % 10 ? DIGITS[n % 10] : '');
  if (n < 100) return DIGITS[Math.floor(n / 10)] + '十' + (n % 10 ? DIGITS[n % 10] : '');
  return String(n).split('').map((d) => DIGITS[+d]).join('');
}
export function normalizeZh(s) {
  return s
    .replace(/\d+/g, (m) => numToZh(+m))
    .replace(/[^㐀-鿿]/g, '');
}

/** Alinha (Levenshtein) a transcrição com o alvo e marca cada caractere do alvo como certo/errado. */
function align(target, heard) {
  const T = [...target], H = [...heard];
  const n = T.length, m = H.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (sameSound(T[i - 1], H[j - 1]) ? 0 : 1));
  const ok = Array(n).fill(false);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + (sameSound(T[i - 1], H[j - 1]) ? 0 : 1)) {
      ok[i - 1] = sameSound(T[i - 1], H[j - 1]);
      i--; j--;
    } else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  const dist = d[n][m];
  return { ok, score: Math.max(0, 1 - dist / Math.max(n, 1)) };
}

/** Avalia as alternativas do reconhecedor e retorna a melhor. */
export function scoreSpeech(target, alternatives) {
  const tgt = normalizeZh(target);
  let best = { score: 0, ok: [...tgt].map(() => false), heard: alternatives[0] || '' };
  for (const alt of alternatives) {
    const heard = normalizeZh(alt);
    if (!heard) continue;
    const r = align(tgt, heard);
    if (r.score > best.score) best = { ...r, heard: alt };
  }
  best.chars = [...tgt];
  return best;
}

/** Escuta o microfone uma vez. onInterim recebe a transcrição parcial. */
export function listen({ onInterim, lang = 'zh-CN', maxMs = 8000 } = {}) {
  let rec, timer;
  const promise = new Promise((resolve) => {
    if (!SR) return resolve({ alternatives: [], error: 'unsupported' });
    rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    let finished = false;
    const finish = (r) => { if (!finished) { finished = true; clearTimeout(timer); resolve(r); } };
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      if (res.isFinal) {
        const alts = [];
        for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
        finish({ alternatives: alts });
      } else onInterim?.(res[0].transcript);
    };
    rec.onerror = (e) => finish({ alternatives: [], error: e.error });
    rec.onend = () => finish({ alternatives: [], error: 'no-speech' });
    try { rec.start(); } catch (err) { finish({ alternatives: [], error: String(err) }); }
    timer = setTimeout(() => { try { rec.stop(); } catch {} }, maxMs);
  });
  return { promise, stop: () => { try { rec?.stop(); } catch {} } };
}

export const ERROR_TEXT = {
  'not-allowed': 'Permissão de microfone negada. Libere o microfone nas configurações do navegador.',
  'service-not-allowed': 'O reconhecimento de fala não está disponível neste navegador.',
  'no-speech': 'Não ouvi nada. Fale mais perto do microfone.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de fala precisa de internet.',
  unsupported: 'Seu navegador não suporta reconhecimento de fala (use Chrome ou Edge).',
};

/** Gravação simples (fallback sem reconhecimento): grava e devolve URL do áudio. */
export async function recordClip(ms = 3000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream);
  const chunks = [];
  mr.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (mr.onstop = r));
  mr.start();
  setTimeout(() => mr.state !== 'inactive' && mr.stop(), ms);
  await done;
  stream.getTracks().forEach((t) => t.stop());
  return URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
}
