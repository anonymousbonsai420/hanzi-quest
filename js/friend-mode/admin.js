// Modo Amigos: painel do administrador — membros (revogar/reativar, limite) e convites.
import { h } from '../util.js';
import { modal, toast } from '../ui.js';
import * as cloud from './cloud.js';
import { share, fmtDate, ago } from './helpers.js';

export function adminModal() {
  const body = h('div', { class: 'admin' }, h('p', { class: 'center muted' }, '⏳ Carregando…'));
  modal({ title: '🛡️ Painel do administrador', body, actions: [{ label: 'Fechar', value: true, class: 'ghost' }], className: 'admin-modal' });
  const reload = () => cloud.adminOverview().then((d) => drawAdmin(body, d, reload)).catch((e) => body.replaceChildren(h('p', {}, cloud.errorMessage(e))));
  reload();
}

function drawAdmin(body, d, reload) {
  const run = async (e, fn, okMsg) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { await fn(); if (okMsg) toast(okMsg, { icon: '✅' }); await reload(); } catch (err) { toast(cloud.errorMessage(err), { icon: '⚠️', ms: 5000 }); btn.disabled = false; }
  };
  const meId = cloud.myProfile()?.user_id;
  const free = Math.max(0, d.member_cap - d.active);
  const pending = d.invites.filter((i) => !i.used_at && !i.grants_admin);
  const now = Date.now();

  const note = h('input', { class: 'field-input', placeholder: 'Para quem? (opcional)', maxlength: 60 });
  const days = h('select', {}, [[1, '1 dia'], [3, '3 dias'], [7, '7 dias'], [14, '14 dias'], [30, '30 dias']].map(([v, l]) => h('option', { value: v, selected: v === 7 }, l)));
  const cap = h('input', { class: 'field-input cap-input', type: 'number', min: 1, max: 100, value: d.member_cap });

  body.replaceChildren(
    h('section', {},
      h('h3', {}, `Membros · ${d.active}/${d.member_cap}`),
      h('p', { class: 'muted small' }, free > 0 ? `${free} vaga${free > 1 ? 's' : ''} livre${free > 1 ? 's' : ''}. O limite conta todos os membros ativos, incluindo você.` : 'Grupo cheio: novos convites só funcionam se você liberar vagas ou aumentar o limite.'),
      d.members.map((m) => h('div', { class: `person-row ${m.status === 'revoked' ? 'revoked' : ''}` },
        h('span', { class: 'p-avatar' }, m.avatar),
        h('div', { class: 'grow' },
          h('b', {}, m.display_name, ' '), h('span', { class: 'muted small' }, `@${m.username}`),
          m.role === 'admin' && h('span', { class: 'pill gold' }, 'admin'),
          m.status === 'revoked' && h('span', { class: 'pill red' }, 'revogado'),
          h('div', { class: 'muted small' }, `Entrou em ${fmtDate(m.joined_at)} · ${m.xp ?? 0} XP${m.reported_at ? ` · ativo ${ago(new Date(m.reported_at).getTime())}` : ''}`)),
        m.user_id !== meId && (m.status === 'active'
          ? h('button', { class: 'btn danger small', onClick: (e) => run(e, () => cloud.setMemberStatus(m.user_id, 'revoked'), `Acesso de @${m.username} revogado.`) }, 'Revogar')
          : h('button', { class: 'btn ghost small', onClick: (e) => run(e, () => cloud.setMemberStatus(m.user_id, 'active'), `@${m.username} reativado.`) }, 'Reativar')))),
      h('form', { class: 'inline-form', onSubmit: (e) => { e.preventDefault(); run({ currentTarget: e.target.querySelector('button') }, () => cloud.setMemberCap(+cap.value), 'Limite atualizado.'); } },
        h('span', { class: 'field-label' }, 'Limite de membros'), cap, h('button', { class: 'btn ghost small', type: 'submit' }, 'Salvar')),
      h('p', { class: 'muted small' }, 'Revogar bloqueia o acesso na hora e libera a vaga. Para apagar a conta de vez ou redefinir uma senha: Supabase → Authentication → Users.')),
    h('section', {},
      h('h3', {}, 'Convites'),
      h('form', { class: 'inline-form wrap', onSubmit: (e) => {
        e.preventDefault();
        run({ currentTarget: e.target.querySelector('button') }, async () => {
          const code = await cloud.createInvite(note.value.trim(), +days.value);
          share(`Convite para o Hanzi Quest 汉字之旅 (uso único): ${code}`, cloud.inviteLink(code));
        }, 'Convite criado.');
      } }, note, days, h('button', { class: 'btn green small', type: 'submit' }, '🎟️ Gerar convite')),
      h('p', { class: 'muted small' }, 'Cada convite vale para uma pessoa. Quem entrar pelo seu convite já vira seu amigo.'),
      pending.length === 0 && h('p', { class: 'muted small' }, 'Nenhum convite pendente.'),
      pending.map((i) => {
        const expired = i.expires_at && new Date(i.expires_at).getTime() < now;
        return h('div', { class: `person-row ${expired ? 'revoked' : ''}` },
          h('div', { class: 'grow' },
            h('code', { class: 'code-chip static' }, i.code), ' ', i.note && h('span', {}, i.note),
            h('div', { class: 'muted small' }, expired ? 'Expirado' : `Válido até ${fmtDate(i.expires_at)}`)),
          !expired && h('button', { class: 'btn ghost small', onClick: () => share(`Convite para o Hanzi Quest 汉字之旅 (uso único): ${i.code}`, cloud.inviteLink(i.code)) }, 'Enviar'),
          h('button', { class: 'btn danger small', 'aria-label': `Apagar convite ${i.code}`, onClick: (e) => run(e, () => cloud.deleteInvite(i.code), 'Convite apagado.') }, '🗑️'));
      }),
      d.invites.some((i) => i.used_at) && h('details', { class: 'used-invites' },
        h('summary', { class: 'muted small' }, 'Convites usados'),
        d.invites.filter((i) => i.used_at).map((i) => h('div', { class: 'muted small' }, `${i.code} → @${i.used_by || '(conta apagada)'} em ${fmtDate(i.used_at)}${i.note ? ` · ${i.note}` : ''}`)))));
}
