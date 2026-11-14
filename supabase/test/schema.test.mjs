// Testes do banco do modo Amigos: roda supabase/schema.sql num Postgres embutido (PGlite)
// com um "auth" simulado do Supabase e verifica convites, limite de membros, privacidade e limites de XP.
//
// Uso (dependência só de teste, não faz parte do app):
//   cd supabase/test && npm i --no-save @electric-sql/pglite@0.2.17 && node schema.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schema = readFileSync(process.argv[2] || fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  -- como o Supabase: privilégios padrão amplos em public
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

await db.exec(schema);
const adminCode = (await db.query(`select code from public.invites where grants_admin`)).rows[0]?.code;
ok(/^HQ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(adminCode || ''), 'schema gera convite de administrador', adminCode);

async function as(role, uid, sql, params = []) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  await db.exec(`set role ${role}`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec(`reset role`); }
}
async function err(fn) { try { await fn(); return null; } catch (e) { return e.message; } }
async function signup(username, invite, extra = {}) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${username}@test`, JSON.stringify({ username, invite, display_name: extra.name, avatar: extra.avatar })]);
  return r.rows[0].id;
}
const rpc1 = async (uid, sql, params) => Object.values((await as('authenticated', uid, sql, params))[0])[0];

// --- antes do login
ok((await as('anon', null, `select public.check_invite('nada') r`))[0].r === 'invalid', 'anon: convite inexistente → invalid');
ok((await as('anon', null, `select public.check_invite($1) r`, [adminCode]))[0].r === 'ok', 'anon: convite admin → ok');
ok((await as('anon', null, `select public.check_invite($1, 'Victor!') r`, [adminCode]))[0].r === 'username_invalid', 'anon: nome inválido');
ok(!!await err(() => as('anon', null, `select public.me()`)), 'anon não pode chamar me()');
ok(!!await err(() => as('anon', null, `select * from public.invites`)), 'anon não lê tabela de convites');

// --- cadastro
ok(!!await err(() => signup('intruso', 'HQ-AAAA-BBBB')), 'cadastro com convite falso é recusado');
ok((await db.query(`select count(*)::int n from auth.users`)).rows[0].n === 0, '…e o usuário não é criado');
ok(!!await err(() => signup('semconvite', undefined)), 'cadastro sem convite (ex.: anônimo) é recusado');
ok(!!await err(() => signup('X', adminCode)), 'nome de usuário inválido é recusado');

const victor = await signup('victor', adminCode, { name: 'Victor', avatar: '🐉' });
const me = await rpc1(victor, `select public.me()`);
ok(me.role === 'admin' && me.status === 'active' && /^[A-Z2-9]{6}$/.test(me.friend_code), 'admin criado com código de amigo', me.friend_code);
ok(!!await err(() => signup('outro', adminCode)), 'convite de admin não pode ser reutilizado');
ok((await as('anon', null, `select public.check_invite($1) r`, [adminCode]))[0].r === 'used', 'check_invite → used');

// --- convites e limite de 5
const codes = [];
for (let i = 0; i < 5; i++) codes.push(await rpc1(victor, `select public.admin_create_invite($1, 7)`, [`amigo ${i}`]));
ok(codes.every((c) => /^HQ-/.test(c)) && new Set(codes).size === 5, 'admin cria convites únicos');
const ana = await signup('ana', codes[0], { name: 'Ana' });
const bruno = await signup('bruno', codes[1]);
const caio = await signup('caio', codes[2]);
ok((await as('anon', null, `select public.check_invite($1, 'ana') r`, [codes[3]]))[0].r === 'username_taken', 'nome já usado → username_taken');
const dani = await signup('dani', codes[3]);
ok((await as('anon', null, `select public.check_invite($1) r`, [codes[4]]))[0].r === 'full', 'com 5 ativos o convite vira full');
ok(!!await err(() => signup('edu', codes[4])), '6º membro é recusado (limite 5)');

// --- não-membro (conta sem linha em members)
const ghost = (await db.query(`select gen_random_uuid() id`)).rows[0].id;
ok((await rpc1(ghost, `select public.me()`)) === null, 'usuário sem convite: me() vazio');
ok(!!await err(() => as('authenticated', ghost, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`)), 'usuário sem convite não vê placar');
ok(!!await err(() => as('authenticated', ghost, `select public.report_progress('{}')`)), 'usuário sem convite não envia progresso');
ok(!!await err(() => as('authenticated', ana, `select * from public.members`)), 'membro não lê tabelas diretamente');
ok(!!await err(() => as('authenticated', ana, `update public.stats set xp = 999999`)), 'membro não altera tabelas diretamente');
ok(!!await err(() => as('authenticated', ana, `select public.handle_new_user()`)), 'função do gatilho não é chamável');

// --- progresso
const today = (await db.query(`select current_date::text d`)).rows[0].d;
const yday = (await db.query(`select (current_date - 1)::text d`)).rows[0].d;
const old = (await db.query(`select (current_date - 60)::text d`)).rows[0].d;
let r = await rpc1(ana, `select public.report_progress($1)`, [{ xp: 5000, streak: 4, best_streak: 9, last_day: today, words_learned: 40, days: { [today]: 80, [yday]: 9999, [old]: 30, lixo: 5 } }]);
ok(r.xp === 5000, '1º envio aceita progresso existente', JSON.stringify(r));
r = await rpc1(ana, `select public.report_progress($1)`, [{ xp: 999999 }]);
ok(r.xp === 6500, 'salto absurdo de XP é limitado (+1500/dia)', JSON.stringify(r));
r = await rpc1(ana, `select public.report_progress($1)`, [{ xp: 10, days: { [today]: 20 } }]);
ok(r.xp === 6500, 'XP nunca diminui');
const det = await rpc1(ana, `select public.friend_detail($1)`, [ana]);
ok(det.days[yday] === 1500 && det.days[today] === 80 && det.days[old] === 30 && det.stats.level === 16, 'XP diário limitado a 1500, dia não diminui, nível calculado', JSON.stringify({ d: det.days, lv: det.stats.level }));
await rpc1(bruno, `select public.report_progress($1)`, [{ xp: 300, days: { [today]: 300 } }]);

// --- amizades e privacidade
let ov = await rpc1(ana, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`);
ok(ov.people.map((p) => p.username).sort().join() === 'ana,victor', 'ana vê só ela e quem a convidou', ov.people.map((p) => p.username).join());
ok(!!await err(() => as('authenticated', ana, `select public.friend_detail($1)`, [bruno])), 'ana não vê detalhes de bruno (não são amigos)');
const brunoCode = (await rpc1(bruno, `select public.me()`)).friend_code;
ok(await rpc1(ana, `select public.send_friend_request($1)`, [brunoCode.toLowerCase()]) === 'requested', 'pedido de amizade enviado');
ok(await rpc1(ana, `select public.send_friend_request($1)`, [brunoCode]) === 'already_requested', 'pedido duplicado detectado');
ok(await rpc1(ana, `select public.send_friend_request('ZZZZZZ')`) === 'not_found', 'código inexistente → not_found');
ok(await rpc1(ana, `select public.send_friend_request($1)`, [me.friend_code]) === 'already_friends', 'convidado já é amigo de quem convidou');
ov = await rpc1(bruno, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`);
ok(ov.incoming.length === 1 && ov.incoming[0].username === 'ana', 'bruno vê o pedido recebido');
ok((await rpc1(ana, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`)).outgoing.length === 1, 'ana vê o pedido enviado');
await as('authenticated', caio, `select public.respond_friend_request($1, true)`, [ov.incoming[0].id]);
ok((await rpc1(ana, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`)).people.length === 2, 'terceiro não consegue aceitar pedido alheio');
await as('authenticated', bruno, `select public.respond_friend_request($1, true)`, [ov.incoming[0].id]);
ov = await rpc1(ana, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`);
ok(ov.people.map((p) => p.username).join() === 'ana,bruno,victor', 'após aceitar, placar ordenado por XP da semana', ov.people.map((p) => `${p.username}:${p.week_xp}`).join());
ok(ov.people[0].week_xp === 1580, 'XP da semana soma daily_xp', String(ov.people[0].week_xp));

// --- admin
ok(!!await err(() => as('authenticated', ana, `select public.admin_overview()`)), 'não-admin não acessa painel');
ok(!!await err(() => as('authenticated', ana, `select public.admin_create_invite()`)), 'não-admin não cria convite');
let ad = await rpc1(victor, `select public.admin_overview()`);
ok(ad.active === 5 && ad.member_cap === 5 && ad.members.length === 5, 'painel admin lista membros', `${ad.active}/${ad.member_cap}`);
ok(!!await err(() => as('authenticated', victor, `select public.admin_set_member_status($1, 'revoked')`, [victor])), 'admin não revoga a si mesmo');
await as('authenticated', victor, `select public.admin_set_member_status($1, 'revoked')`, [bruno]);
ok((await rpc1(bruno, `select public.me()`)).status === 'revoked', 'revogado: me() mostra status');
ok(!!await err(() => as('authenticated', bruno, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`)), 'revogado perde acesso ao placar');
ok(!(await rpc1(ana, `select public.friends_overview(current_date - (extract(isodow from current_date)::int - 1))`)).people.some((p) => p.username === 'bruno'), 'revogado some do placar dos amigos');
ok((await as('anon', null, `select public.check_invite($1) r`, [codes[4]]))[0].r === 'ok', 'vaga liberada após revogar');
const edu = await signup('edu', codes[4]);
ok(!!edu, 'novo membro entra na vaga');
ok(!!await err(() => as('authenticated', victor, `select public.admin_set_member_status($1, 'active')`, [bruno])), 'reativar com limite cheio é recusado');
await as('authenticated', victor, `select public.admin_set_cap(6)`);
await as('authenticated', victor, `select public.admin_set_member_status($1, 'active')`, [bruno]);
ok((await rpc1(bruno, `select public.me()`)).status === 'active', 'após aumentar o limite, reativa');
const exp = await rpc1(victor, `select public.admin_create_invite('x', 1)`);
await db.exec(`update public.invites set expires_at = now() - interval '1 minute' where code = '${exp}'`);
await as('authenticated', victor, `select public.admin_set_cap(10)`);
ok((await as('anon', null, `select public.check_invite($1) r`, [exp]))[0].r === 'expired', 'convite expirado → expired');
ok(!!await err(() => signup('fabi', exp)), 'cadastro com convite expirado é recusado');
const del = await rpc1(victor, `select public.admin_create_invite()`);
await as('authenticated', victor, `select public.admin_delete_invite($1)`, [del]);
ok((await as('anon', null, `select public.check_invite($1) r`, [del]))[0].r === 'invalid', 'convite apagado deixa de valer');

// --- remover amizade
await as('authenticated', ana, `select public.remove_friend($1)`, [bruno]);
ok(!!await err(() => as('authenticated', ana, `select public.friend_detail($1)`, [bruno])), 'amizade desfeita remove acesso');

// --- reexecução do schema
await db.exec(`reset role`);
await db.exec(schema);
ok((await db.query(`select count(*)::int n from public.members`)).rows[0].n === 6, 'schema reexecutado sem perder dados');
ok((await db.query(`select count(*)::int n from public.invites where grants_admin and used_at is null`)).rows[0].n === 0, 'reexecução não gera novo convite de admin');

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
