// Modo Amigos: comparação "você × amigo" (estatísticas lado a lado e mapas de atividade).
import { h } from '../util.js';
import { state } from '../state.js';
import { levelInfo } from '../game.js';
import { modal, heatmap } from '../ui.js';
import * as cloud from './cloud.js';
import { act, fmtDate, ago } from './helpers.js';

export function compareModal(p) {
  const body = h('div', { class: 'compare' }, h('p', { class: 'center muted' }, '⏳ Carregando…'));
  const actions = [{ label: 'Fechar', value: null, class: 'ghost' }, { label: 'Desfazer amizade', value: 'remove', class: 'danger' }];
  modal({ title: `Você × ${p.display_name}`, body, actions, className: 'compare-modal' }).then(async (v) => {
    if (v !== 'remove') return;
    const ok = await modal({ title: `Desfazer amizade com ${p.display_name}?`, body: 'Vocês deixam de ver as estatísticas um do outro. Dá para adicionar de novo pelo código de amigo.', actions: [{ label: 'Cancelar', value: false, class: 'ghost' }, { label: 'Desfazer', value: true, class: 'danger' }] });
    if (ok) act(null, () => cloud.removeFriend(p.user_id), 'Amizade desfeita.');
  });
  cloud.friendDetail(p.user_id).then((d) => {
    const mine = cloud.snapshot();
    const meOv = cloud.cachedOverview()?.people.find((x) => x.is_me);
    const s = d.stats;
    const rows = [
      ['Nível', levelInfo().level, s.level],
      ['XP total', state.xp, s.xp],
      ['XP na semana', meOv?.week_xp ?? 0, p.week_xp],
      ['Ofensiva atual', mine.streak, cloud.liveStreak(s)],
      ['Melhor ofensiva', mine.best_streak, s.best_streak],
      ['Palavras aprendidas', mine.words_learned, s.words_learned],
      ['Palavras dominadas', mine.words_mastered, s.words_mastered],
      ['Lições', mine.lessons, s.lessons],
      ['Recorde relâmpago', mine.speed_record, s.speed_record],
      ['Precisão', `${mine.accuracy}%`, `${s.accuracy}%`],
      ['Tempo de estudo', `${mine.minutes}m`, `${s.minutes}m`],
    ];
    const num = (v) => parseFloat(v) || 0;
    body.replaceChildren(
      h('div', { class: 'cmp-head' },
        h('div', {}, h('span', { class: 'p-avatar big' }, cloud.myProfile()?.avatar || '🐼'), h('b', {}, 'Você')),
        h('div', { class: 'cmp-vs' }, 'VS'),
        h('div', {}, h('span', { class: 'p-avatar big' }, d.avatar), h('b', {}, d.display_name))),
      h('table', { class: 'cmp-table' }, h('tbody', {}, rows.map(([label, a, b]) => h('tr', {},
        h('td', { class: num(a) > num(b) ? 'win' : '' }, a),
        h('th', { scope: 'row' }, label),
        h('td', { class: num(b) > num(a) ? 'win' : '' }, b))))),
      h('div', { class: 'cmp-maps' },
        h('div', {}, h('div', { class: 'muted small' }, 'Sua atividade'), heatmap(state.days, 12)),
        h('div', {}, h('div', { class: 'muted small' }, `Atividade de ${d.display_name}`), heatmap(d.days || {}, 12))),
      h('p', { class: 'muted small center' }, `Membro desde ${fmtDate(d.joined_at)}${s.reported_at ? ` · atualizado ${ago(new Date(s.reported_at).getTime())}` : ''}`));
  }).catch((e) => body.replaceChildren(h('p', { class: 'center' }, cloud.errorMessage(e))));
}
