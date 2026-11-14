-- =====================================================================
-- Hanzi Quest · banco de dados do modo "Amigos" (Supabase / Postgres)
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
-- Pode ser executado de novo sem perder dados (tudo é idempotente).
-- No fim ele mostra o seu CONVITE DE ADMINISTRADOR (válido por 7 dias).
--
-- Modelo de acesso (somente por convite):
--   • Cadastro exige um código de convite válido, de uso único e não expirado,
--     e respeita o limite de membros ativos (settings.member_cap, padrão 5,
--     contando o administrador). Quem valida é o gatilho em auth.users: se o
--     convite não serve, a conta nem chega a ser criada.
--   • Nenhuma tabela é acessível diretamente pela chave pública (RLS ligado,
--     sem políticas, e sem privilégios para anon/authenticated). O app só
--     conversa com as funções abaixo, e todas verificam se quem chama é um
--     membro ATIVO. Membro revogado perde o acesso na hora.
--   • Só os amigos aceitos enxergam as estatísticas uns dos outros.
-- =====================================================================

-- ---------------------------------------------------------------- tabelas

create table if not exists public.settings (
  id boolean primary key default true check (id),
  member_cap int not null default 5 check (member_cap between 1 and 100)
);
insert into public.settings (id) values (true) on conflict do nothing;

create table if not exists public.invites (
  code         text primary key,
  note         text check (char_length(note) <= 60),
  grants_admin boolean not null default false,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  used_at      timestamptz,
  used_by      uuid references auth.users on delete set null
);

create table if not exists public.members (
  user_id      uuid primary key references auth.users on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar       text not null default '🐼' check (char_length(avatar) between 1 and 8),
  role         text not null default 'member' check (role in ('admin', 'member')),
  status       text not null default 'active' check (status in ('active', 'revoked')),
  friend_code  text not null unique,
  invited_by   uuid references auth.users on delete set null,
  invite_code  text,
  joined_at    timestamptz not null default now()
);

create table if not exists public.stats (
  user_id        uuid primary key references public.members on delete cascade,
  xp             int not null default 0,
  level          int not null default 1,
  streak         int not null default 0,
  best_streak    int not null default 0,
  last_day       date,
  words_learned  int not null default 0,
  words_mastered int not null default 0,
  lessons        int not null default 0,
  speed_record   int not null default 0,
  accuracy       int not null default 0,
  minutes        int not null default 0,
  reported_at    timestamptz
);

create table if not exists public.daily_xp (
  user_id uuid not null references public.members on delete cascade,
  day     date not null,
  xp      int not null check (xp between 0 and 1500),
  primary key (user_id, day)
);

create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references public.members on delete cascade,
  addressee  uuid not null references public.members on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- Tudo trancado: o app usa apenas as funções (RPC) abaixo.
alter table public.settings    enable row level security;
alter table public.invites     enable row level security;
alter table public.members     enable row level security;
alter table public.stats       enable row level security;
alter table public.daily_xp    enable row level security;
alter table public.friendships enable row level security;
revoke all on public.settings, public.invites, public.members, public.stats, public.daily_xp, public.friendships
  from public, anon, authenticated;

-- ---------------------------------------------------------------- utilitários internos

-- Código aleatório no alfabeto sem caracteres ambíguos (sem 0/O, 1/I).
create or replace function public.random_code(n int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  b bytea;
begin
  while char_length(out) < n loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    -- bytes 6 e 8 do UUID v4 têm bits fixos (versão/variante); usa os outros
    for i in 0..15 loop
      continue when i in (6, 8);
      exit when char_length(out) >= n;
      out := out || substr(abc, (get_byte(b, i) % 32) + 1, 1);
    end loop;
  end loop;
  return out;
end $$;

create or replace function public.new_invite_code()
returns text language plpgsql volatile set search_path = '' as $$
declare c text;
begin
  loop
    c := 'HQ-' || public.random_code(4) || '-' || public.random_code(4);
    exit when not exists (select 1 from public.invites where code = c);
  end loop;
  return c;
end $$;

create or replace function public.new_friend_code()
returns text language plpgsql volatile set search_path = '' as $$
declare c text;
begin
  loop
    c := public.random_code(6);
    exit when not exists (select 1 from public.members where friend_code = c);
  end loop;
  return c;
end $$;

create or replace function public.is_member(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = uid and status = 'active');
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = uid and status = 'active' and role = 'admin');
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;

create or replace function public.assert_member()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'HQ_FORBIDDEN' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function public.assert_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'HQ_FORBIDDEN' using errcode = '42501'; end if;
  return auth.uid();
end $$;

-- Estado de um convite: ok | invalid | used | expired | full
create or replace function public.invite_state(p_code text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv from public.invites where code = upper(trim(p_code));
  if not found then return 'invalid'; end if;
  if inv.used_at is not null then return 'used'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then return 'expired'; end if;
  if inv.grants_admin and exists (select 1 from public.members where role = 'admin') then return 'invalid'; end if;
  if (select count(*) from public.members where status = 'active') >= (select member_cap from public.settings) then
    return 'full';
  end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------- cadastro (gatilho)

-- Roda na mesma transação que cria o usuário: se o convite não serve, o cadastro é desfeito.
-- O app envia em user_metadata: { invite, username, display_name, avatar }.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code   text := upper(trim(coalesce(meta ->> 'invite', '')));
  v_user   text := lower(trim(coalesce(meta ->> 'username', '')));
  v_name   text := left(nullif(trim(coalesce(meta ->> 'display_name', '')), ''), 24);
  v_avatar text := left(nullif(trim(coalesce(meta ->> 'avatar', '')), ''), 8);
  v_state  text;
  inv      public.invites%rowtype;
begin
  perform 1 from public.settings for update;            -- serializa cadastros (limite de membros)
  select * into inv from public.invites where code = v_code for update;
  v_state := public.invite_state(v_code);
  if v_state <> 'ok' then
    raise exception 'HQ_INVITE_%', upper(v_state) using errcode = '42501';
  end if;
  if v_user !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'HQ_USERNAME_INVALID' using errcode = '22023';
  end if;

  insert into public.members (user_id, username, display_name, avatar, role, friend_code, invited_by, invite_code)
  values (new.id, v_user, coalesce(v_name, v_user), coalesce(v_avatar, '🐼'),
          case when inv.grants_admin then 'admin' else 'member' end,
          public.new_friend_code(), inv.created_by, v_code);
  insert into public.stats (user_id) values (new.id);
  update public.invites set used_at = now(), used_by = new.id where code = v_code;

  -- quem convidou vira amigo automaticamente
  if inv.created_by is not null and public.is_member(inv.created_by) then
    insert into public.friendships (requester, addressee, status)
    values (inv.created_by, new.id, 'accepted') on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists hq_on_auth_user_created on auth.users;
create trigger hq_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RPC: público (antes do login)

-- Valida o convite (e o nome de usuário) antes do cadastro, para mostrar mensagens claras.
-- Retorna: ok | invalid | used | expired | full | username_invalid | username_taken
create or replace function public.check_invite(p_code text, p_username text default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  s text := public.invite_state(p_code);
  u text := lower(trim(coalesce(p_username, '')));
begin
  if s <> 'ok' or p_username is null then return s; end if;
  if u !~ '^[a-z0-9_]{3,20}$' then return 'username_invalid'; end if;
  if exists (select 1 from public.members where username = u) then return 'username_taken'; end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------- RPC: membro

-- Perfil do usuário logado (também para membro revogado, para o app avisar).
create or replace function public.me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', m.user_id, 'username', m.username, 'display_name', m.display_name, 'avatar', m.avatar,
    'role', m.role, 'status', m.status, 'friend_code', m.friend_code, 'joined_at', m.joined_at,
    'reported_at', s.reported_at)
  from public.members m left join public.stats s using (user_id)
  where m.user_id = auth.uid();
$$;

create or replace function public.update_profile(p_display_name text, p_avatar text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_member();
begin
  update public.members
     set display_name = coalesce(left(nullif(trim(p_display_name), ''), 24), display_name),
         avatar       = coalesce(left(nullif(trim(p_avatar), ''), 8), avatar)
   where user_id = uid;
end $$;

-- Envia o progresso calculado no app. Regras contra números absurdos:
--   • XP nunca diminui e cresce no máximo 1500 por dia desde o último envio
--     (no primeiro envio aceita o progresso que já existia, até 100 000 XP);
--   • XP diário fica entre 0 e 1500; aceita os últimos 14 dias (84 no primeiro envio).
create or replace function public.report_progress(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := public.assert_member();
  s     public.stats%rowtype;
  v_xp  int;
  v_max int;
  v_win int;
  k     text;
  v     jsonb;
  int_of constant text := '^-?[0-9]{1,9}$';
begin
  select * into s from public.stats where user_id = uid for update;
  v_xp := case when (p ->> 'xp') ~ int_of then (p ->> 'xp')::int else 0 end;
  v_max := case when s.reported_at is null then 100000
                else s.xp + 1500 * (greatest(0, current_date - s.reported_at::date) + 1) end;
  v_xp := greatest(s.xp, least(greatest(v_xp, 0), v_max));
  v_win := case when s.reported_at is null then 84 else 14 end;

  update public.stats set
    xp             = v_xp,
    level          = floor((1 + sqrt(1 + 4 * v_xp / 25.0)) / 2)::int,
    streak         = case when (p ->> 'streak') ~ int_of then least(greatest((p ->> 'streak')::int, 0), 3650) else streak end,
    best_streak    = case when (p ->> 'best_streak') ~ int_of then least(greatest((p ->> 'best_streak')::int, best_streak), 3650) else best_streak end,
    last_day       = case when (p ->> 'last_day') ~ '^\d{4}-\d{2}-\d{2}$'
                           and (p ->> 'last_day')::date <= current_date + 1 then (p ->> 'last_day')::date else last_day end,
    words_learned  = case when (p ->> 'words_learned') ~ int_of then least(greatest((p ->> 'words_learned')::int, 0), 20000) else words_learned end,
    words_mastered = case when (p ->> 'words_mastered') ~ int_of then least(greatest((p ->> 'words_mastered')::int, 0), 20000) else words_mastered end,
    lessons        = case when (p ->> 'lessons') ~ int_of then least(greatest((p ->> 'lessons')::int, lessons), 100000) else lessons end,
    speed_record   = case when (p ->> 'speed_record') ~ int_of then least(greatest((p ->> 'speed_record')::int, speed_record), 200) else speed_record end,
    accuracy       = case when (p ->> 'accuracy') ~ int_of then least(greatest((p ->> 'accuracy')::int, 0), 100) else accuracy end,
    minutes        = case when (p ->> 'minutes') ~ int_of then least(greatest((p ->> 'minutes')::int, minutes), 1000000) else minutes end,
    reported_at    = now()
  where user_id = uid;

  if jsonb_typeof(p -> 'days') = 'object' then
    for k, v in select * from jsonb_each(p -> 'days') loop
      continue when k !~ '^\d{4}-\d{2}-\d{2}$' or v::text !~ '^[0-9]{1,6}$';
      continue when k::date > current_date + 1 or k::date < current_date - v_win;
      insert into public.daily_xp (user_id, day, xp)
      values (uid, k::date, least(v::text::int, 1500))
      on conflict (user_id, day) do update set xp = greatest(public.daily_xp.xp, excluded.xp);
    end loop;
  end if;
  return jsonb_build_object('xp', v_xp);
end $$;

-- Placar: eu + amigos aceitos, com XP da semana (p_week_start = segunda-feira local)
-- e da semana anterior; também os pedidos de amizade pendentes.
create or replace function public.friends_overview(p_week_start date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.assert_member();
  ws  date := p_week_start;
  people jsonb;
  incoming jsonb;
  outgoing jsonb;
begin
  if ws is null or abs(ws - current_date) > 8 then
    ws := current_date - ((extract(isodow from current_date)::int) - 1);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.week_xp desc, t.xp desc), '[]'::jsonb) into people
  from (
    select m.user_id, m.username, m.display_name, m.avatar, (m.user_id = uid) as is_me,
           s.xp, s.level, s.streak, s.best_streak, s.last_day, s.words_learned, s.words_mastered,
           s.lessons, s.speed_record, s.accuracy, s.minutes, s.reported_at,
           coalesce((select sum(d.xp) from public.daily_xp d where d.user_id = m.user_id and d.day >= ws and d.day < ws + 7), 0)::int as week_xp,
           coalesce((select sum(d.xp) from public.daily_xp d where d.user_id = m.user_id and d.day >= ws - 7 and d.day < ws), 0)::int as last_week_xp
      from public.members m join public.stats s using (user_id)
     where m.status = 'active' and (m.user_id = uid or public.are_friends(uid, m.user_id))
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'user_id', m.user_id, 'username', m.username, 'display_name', m.display_name,
           'avatar', m.avatar, 'created_at', f.created_at) order by f.created_at), '[]'::jsonb) into incoming
    from public.friendships f join public.members m on m.user_id = f.requester
   where f.addressee = uid and f.status = 'pending' and m.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'user_id', m.user_id, 'username', m.username, 'display_name', m.display_name,
           'avatar', m.avatar, 'created_at', f.created_at) order by f.created_at), '[]'::jsonb) into outgoing
    from public.friendships f join public.members m on m.user_id = f.addressee
   where f.requester = uid and f.status = 'pending' and m.status = 'active';

  return jsonb_build_object('week_start', ws, 'people', people, 'incoming', incoming, 'outgoing', outgoing);
end $$;

-- Detalhe de um amigo (ou de mim): estatísticas + XP por dia das últimas 12 semanas.
create or replace function public.friend_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.assert_member();
  r   jsonb;
begin
  if p_user <> uid and not public.are_friends(uid, p_user) then
    raise exception 'HQ_FORBIDDEN' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'user_id', m.user_id, 'username', m.username, 'display_name', m.display_name, 'avatar', m.avatar,
           'joined_at', m.joined_at, 'stats', to_jsonb(s) - 'user_id',
           'days', coalesce((select jsonb_object_agg(d.day, d.xp) from public.daily_xp d
                              where d.user_id = m.user_id and d.day >= current_date - 90), '{}'::jsonb))
    into r
    from public.members m join public.stats s using (user_id)
   where m.user_id = p_user and m.status = 'active';
  return r;
end $$;

-- Pede amizade pelo código do amigo. Se a outra pessoa já tinha pedido, aceita na hora.
-- Retorna: requested | accepted | already_friends | already_requested | not_found | self
create or replace function public.send_friend_request(p_friend_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := public.assert_member();
  other uuid;
  f     public.friendships%rowtype;
begin
  select user_id into other from public.members
   where friend_code = upper(trim(p_friend_code)) and status = 'active';
  if other is null then return 'not_found'; end if;
  if other = uid then return 'self'; end if;
  select * into f from public.friendships
   where least(requester, addressee) = least(uid, other) and greatest(requester, addressee) = greatest(uid, other);
  if found then
    if f.status = 'accepted' then return 'already_friends'; end if;
    if f.requester = uid then return 'already_requested'; end if;
    update public.friendships set status = 'accepted' where id = f.id;
    return 'accepted';
  end if;
  insert into public.friendships (requester, addressee) values (uid, other);
  return 'requested';
end $$;

create or replace function public.respond_friend_request(p_id bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_member();
begin
  if p_accept then
    update public.friendships set status = 'accepted' where id = p_id and addressee = uid and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = uid and status = 'pending';
  end if;
end $$;

-- Desfaz uma amizade (ou cancela um pedido enviado).
create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_member();
begin
  delete from public.friendships
   where (requester = uid and addressee = p_user) or (requester = p_user and addressee = uid);
end $$;

-- ---------------------------------------------------------------- RPC: administrador

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public.assert_admin();
begin
  return jsonb_build_object(
    'member_cap', (select member_cap from public.settings),
    'active', (select count(*) from public.members where status = 'active'),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', m.user_id, 'username', m.username, 'display_name', m.display_name, 'avatar', m.avatar,
               'role', m.role, 'status', m.status, 'joined_at', m.joined_at, 'invite_code', m.invite_code,
               'invited_by', (select i.username from public.members i where i.user_id = m.invited_by),
               'reported_at', s.reported_at, 'xp', s.xp) order by m.joined_at)
        from public.members m left join public.stats s using (user_id)), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', i.code, 'note', i.note, 'created_at', i.created_at, 'expires_at', i.expires_at,
               'used_at', i.used_at, 'grants_admin', i.grants_admin,
               'used_by', (select m.username from public.members m where m.user_id = i.used_by)) order by i.created_at desc)
        from public.invites i), '[]'::jsonb));
end $$;

-- Cria um convite de uso único. p_days: validade em dias (1–30).
create or replace function public.admin_create_invite(p_note text default null, p_days int default 7)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_admin();
  c   text := public.new_invite_code();
begin
  insert into public.invites (code, note, created_by, expires_at)
  values (c, left(nullif(trim(p_note), ''), 60), uid, now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30)));
  return c;
end $$;

-- Apaga um convite ainda não usado.
create or replace function public.admin_delete_invite(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_admin();
begin
  delete from public.invites where code = upper(trim(p_code)) and used_at is null;
end $$;

-- Revoga ou reativa um membro. Reativar respeita o limite de membros.
create or replace function public.admin_set_member_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_admin();
begin
  if p_status not in ('active', 'revoked') then raise exception 'HQ_BAD_STATUS' using errcode = '22023'; end if;
  if p_user = uid then raise exception 'HQ_SELF' using errcode = '22023'; end if;
  perform 1 from public.settings for update;
  if p_status = 'active'
     and exists (select 1 from public.members where user_id = p_user and status = 'revoked')
     and (select count(*) from public.members where status = 'active') >= (select member_cap from public.settings) then
    raise exception 'HQ_FULL' using errcode = '42501';
  end if;
  update public.members set status = p_status where user_id = p_user;
end $$;

create or replace function public.admin_set_cap(p_cap int)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_admin();
begin
  update public.settings set member_cap = least(greatest(p_cap, 1), 100);
end $$;

-- ---------------------------------------------------------------- permissões das funções

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.check_invite(text, text) to anon, authenticated;
grant execute on function
  public.me(),
  public.update_profile(text, text),
  public.report_progress(jsonb),
  public.friends_overview(date),
  public.friend_detail(uuid),
  public.send_friend_request(text),
  public.respond_friend_request(bigint, boolean),
  public.remove_friend(uuid),
  public.admin_overview(),
  public.admin_create_invite(text, int),
  public.admin_delete_invite(text),
  public.admin_set_member_status(uuid, text),
  public.admin_set_cap(int)
to authenticated;

-- ---------------------------------------------------------------- convite do administrador

-- Gera (uma única vez) o convite que cria a conta de administrador.
insert into public.invites (code, note, grants_admin, expires_at)
select public.new_invite_code(), 'Conta de administrador', true, now() + interval '7 days'
 where not exists (select 1 from public.members where role = 'admin')
   and not exists (select 1 from public.invites where grants_admin and used_at is null and expires_at > now());

select code as "Seu convite de administrador", expires_at as "Válido até"
  from public.invites
 where grants_admin and used_at is null and expires_at > now()
   and not exists (select 1 from public.members where role = 'admin');
