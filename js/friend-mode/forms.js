// Modo Amigos: formulários de criar conta (com convite), entrar e editar perfil.
import { h } from '../util.js';
import { checkAchievements } from '../game.js';
import { modal, toast, confetti } from '../ui.js';
import * as cloud from './cloud.js';
import { rerender } from './helpers.js';

const AVATARS = ['🐼', '🐉', '🦊', '🐯', '🐱', '🐶', '🐸', '🐵', '🦁', '🐨', '🐰', '🦄', '🐧', '🐢', '🐙', '🌸'];

function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint && h('span', { class: 'field-hint muted small' }, hint));
}

function avatarPicker(current) {
  let value = current || AVATARS[0];
  const el = h('div', { class: 'avatar-pick', role: 'radiogroup', 'aria-label': 'Avatar' }, AVATARS.map((a) => h('button', {
    type: 'button', class: `av ${a === value ? 'active' : ''}`, role: 'radio', 'aria-checked': a === value ? 'true' : 'false',
    onClick: (e) => {
      value = a;
      el.querySelectorAll('.av').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-checked', 'true');
    },
  }, a)));
  el.value = () => value;
  return el;
}

/** Modal com formulário que só fecha quando `onSubmit` dá certo. */
function formModal({ title, fields, submitLabel, onSubmit, extra }) {
  const err = h('div', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn green big', type: 'submit' }, submitLabel);
  const form = h('form', { class: 'form', novalidate: true }, fields, err, submit, extra);
  const p = modal({ title, body: form, actions: [] });
  const close = () => form.closest('.modal-wrap')?._close(true);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = '⏳';
    try {
      const msg = await onSubmit();
      if (typeof msg === 'string') err.textContent = msg;
      else close();
    } catch (ex) {
      err.textContent = cloud.errorMessage(ex);
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
  setTimeout(() => form.querySelector('input:not([value]), input')?.focus(), 250);
  return { promise: p, close };
}

export function signupModal(invite = '') {
  const inv = h('input', { class: 'field-input code-input', name: 'invite', value: invite, placeholder: 'HQ-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const user = h('input', { class: 'field-input', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 20, placeholder: 'ex.: victor_p' });
  const name = h('input', { class: 'field-input', name: 'nickname', autocomplete: 'nickname', maxlength: 24, placeholder: 'Como seus amigos vão te ver' });
  const pass = h('input', { class: 'field-input', type: 'password', name: 'password', autocomplete: 'new-password', minlength: cloud.PASSWORD_MIN });
  const pass2 = h('input', { class: 'field-input', type: 'password', name: 'password2', autocomplete: 'new-password' });
  const av = avatarPicker('🐼');
  user.addEventListener('input', () => { user.value = user.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
  inv.addEventListener('change', async () => {
    if (!inv.value.trim()) return;
    try {
      const st = await cloud.checkInvite(inv.value);
      inv.setCustomValidity(st === 'ok' ? '' : 'x');
      inv.classList.toggle('bad', st !== 'ok');
      inv.closest('.field').querySelector('.field-hint').textContent = st === 'ok' ? '✅ Convite válido' : cloud.INVITE_MSG[st] || '';
    } catch { /* checa de novo no envio */ }
  });
  const m = formModal({
    title: '🎟️ Criar conta',
    fields: [
      field('Código do convite', inv, ' '),
      field('Nome de usuário', user, 'Para entrar. 3 a 20 letras minúsculas, números ou _.'),
      field('Nome de exibição', name),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Avatar'), av),
      field('Senha', pass, `Pelo menos ${cloud.PASSWORD_MIN} caracteres. Não há recuperação por e-mail: guarde-a bem.`),
      field('Confirmar senha', pass2),
    ],
    submitLabel: 'Criar conta',
    extra: h('button', { type: 'button', class: 'link-btn', onClick: () => { m.close(); loginModal(); } }, 'Já tenho conta → Entrar'),
    async onSubmit() {
      if (!inv.value.trim()) return 'Informe o código do convite.';
      if (!cloud.USERNAME_RE.test(user.value)) return cloud.INVITE_MSG.username_invalid;
      if (pass.value.length < cloud.PASSWORD_MIN) return `A senha precisa ter pelo menos ${cloud.PASSWORD_MIN} caracteres.`;
      if (pass.value !== pass2.value) return 'As senhas não conferem.';
      await cloud.signUp({ invite: inv.value, username: user.value, password: pass.value, displayName: name.value.trim() || user.value, avatar: av.value() });
      confetti(120);
      toast(`<b>Bem-vindo à turma!</b><br>Seu progresso já aparece no placar.`, { icon: '🎉', kind: 'green', ms: 4500 });
      checkAchievements();
      location.hash = '#/friends';
      rerender();
    },
  });
  return m.promise;
}

export function loginModal() {
  const user = h('input', { class: 'field-input', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
  const pass = h('input', { class: 'field-input', type: 'password', name: 'password', autocomplete: 'current-password' });
  const m = formModal({
    title: 'Entrar',
    fields: [field('Nome de usuário', user), field('Senha', pass, 'Esqueceu a senha? Peça ao administrador do grupo para redefini-la.')],
    submitLabel: 'Entrar',
    extra: h('button', { type: 'button', class: 'link-btn', onClick: () => { m.close(); signupModal(); } }, 'Tenho um convite → Criar conta'),
    async onSubmit() {
      if (!user.value.trim() || !pass.value) return 'Preencha usuário e senha.';
      await cloud.signIn(user.value, pass.value);
      if (cloud.cloudStatus() === 'revoked') return 'O acesso desta conta foi revogado pelo administrador.';
      toast(`Olá de novo, ${cloud.myProfile()?.display_name || ''}!`, { icon: '👋' });
      checkAchievements();
      rerender();
    },
  });
  return m.promise;
}

export function profileModal(me) {
  const name = h('input', { class: 'field-input', value: me.display_name || '', maxlength: 24 });
  const av = avatarPicker(me.avatar);
  formModal({
    title: '✏️ Editar perfil',
    fields: [field('Nome de exibição', name), h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Avatar'), av)],
    submitLabel: 'Salvar',
    async onSubmit() {
      if (!name.value.trim()) return 'Escolha um nome de exibição.';
      await cloud.updateProfile(name.value.trim(), av.value());
      rerender();
    },
  });
}
