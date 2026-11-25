-- =====================================================================
-- GlaGla Jeux — schéma initial (Undercover + socle multi-jeux)
-- Principe : les secrets (mots / rôles) ne sont JAMAIS lisibles par SELECT.
-- Toute la logique de jeu passe par des fonctions SECURITY DEFINER.
-- =====================================================================

-- ---------- Profils ---------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  pseudo       text not null default 'Joueur' check (char_length(pseudo) between 1 and 20),
  games_played int  not null default 0,
  games_won    int  not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select using (true);
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (pseudo) on public.profiles to authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''), 'Joueur'), 20))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Paires de mots -------------------------------------------
create table public.word_pairs (
  id             uuid primary key default gen_random_uuid(),
  civil_word     text not null check (char_length(civil_word) between 1 and 40),
  undercover_word text not null check (char_length(undercover_word) between 1 and 40),
  category       text not null default 'general',
  lang           text not null default 'fr',
  approved       boolean not null default false,
  submitted_by   uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (lower(civil_word) <> lower(undercover_word))
);
create unique index word_pairs_unique on public.word_pairs (lang, lower(civil_word), lower(undercover_word));
alter table public.word_pairs enable row level security;
create policy word_pairs_select on public.word_pairs for select
  using (approved or submitted_by = auth.uid());
-- Proposition de mots : réservé aux comptes (pas aux invités anonymes), à valider ensuite à la main.
create policy word_pairs_insert on public.word_pairs for insert to authenticated
  with check (
    submitted_by = auth.uid() and approved = false
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
revoke all on public.word_pairs from anon, authenticated;
grant select on public.word_pairs to anon, authenticated;
grant insert (civil_word, undercover_word, category, lang, submitted_by) on public.word_pairs to authenticated;

-- ---------- Salons ----------------------------------------------------
create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  host_id          uuid not null references auth.users(id) on delete cascade,
  game             text not null default 'undercover',
  status           text not null default 'lobby'
                     check (status in ('lobby','reveal','debate','vote','result','mrwhite','finished')),
  settings         jsonb not null default
                     '{"undercovers":1,"mr_white":false,"debate_seconds":180,"lang":"fr","category":null}',
  round            int  not null default 0,
  phase_ends_at    timestamptz,
  starter_id       uuid,
  last_eliminated_id uuid,
  winner           text check (winner in ('civils','impostors','mrwhite')),
  used_pairs       uuid[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.room_players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null check (char_length(name) between 1 and 20),
  is_local      boolean not null default false,   -- joueur sans téléphone, géré par l'hôte
  seat          int not null,
  alive         boolean not null default true,
  ready         boolean not null default false,
  has_voted     boolean not null default false,
  revealed_role text check (revealed_role in ('civil','undercover','mrwhite')),
  joined_at     timestamptz not null default now()
);
create unique index room_players_user_unique on public.room_players (room_id, user_id) where user_id is not null;
create index room_players_room on public.room_players (room_id);

-- Tables secrètes : RLS active, aucune policy => inaccessibles hors fonctions.
create table public.room_secrets (
  room_id         uuid primary key references public.rooms(id) on delete cascade,
  civil_word      text not null,
  undercover_word text not null
);
create table public.player_secrets (
  player_id uuid primary key references public.room_players(id) on delete cascade,
  role      text not null check (role in ('civil','undercover','mrwhite')),
  word      text
);
create table public.votes (
  voter_id  uuid not null references public.room_players(id) on delete cascade,
  target_id uuid not null references public.room_players(id) on delete cascade,
  room_id   uuid not null references public.rooms(id) on delete cascade,
  round     int  not null,
  primary key (voter_id, round)
);
alter table public.rooms          enable row level security;
alter table public.room_players   enable row level security;
alter table public.room_secrets   enable row level security;
alter table public.player_secrets enable row level security;
alter table public.votes          enable row level security;

revoke all on public.rooms, public.room_players, public.room_secrets,
              public.player_secrets, public.votes from anon, authenticated;
grant select on public.rooms, public.room_players to authenticated;

create function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_players where room_id = p_room and user_id = auth.uid());
$$;

create policy rooms_select on public.rooms for select
  using (host_id = auth.uid() or public.is_room_member(id));
create policy room_players_select on public.room_players for select
  using (public.is_room_member(room_id));

-- Temps réel
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.room_players;
  end if;
end $$;

-- ---------- Helpers internes -----------------------------------------
create function public._uid() returns uuid language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  return v;
end $$;

create function public._norm(t text) returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(trim(coalesce(t, ''))), 'àâäéèêëîïôöùûüçœ', 'aaaeeeeiioouuuco'),
    '[^a-z0-9]', '', 'g');
$$;

create function public._gen_code() returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text; i int;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms r where r.code = v_code);
  end loop;
  return v_code;
end $$;

-- Verrouille et renvoie le salon, vérifie que l'appelant est l'hôte.
create function public._host_room(p_room uuid) returns public.rooms
language plpgsql as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.host_id <> public._uid() then raise exception 'not_host'; end if;
  return r;
end $$;

-- L'appelant peut-il agir au nom de ce joueur ? (lui-même, ou l'hôte pour un joueur local)
create function public._can_act(p_player uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.room_players p join public.rooms r on r.id = p.room_id
    where p.id = p_player
      and (p.user_id = auth.uid() or (p.is_local and r.host_id = auth.uid()))
  );
$$;

create function public._touch(p_room uuid) returns void language sql as $$
  update public.rooms set updated_at = now() where id = p_room;
$$;

-- ---------- Salon : création / accès ---------------------------------
create function public.create_room(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_room public.rooms; v_player uuid; v_name text := trim(p_name);
begin
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  insert into public.rooms (code, host_id) values (public._gen_code(), v_uid) returning * into v_room;
  insert into public.room_players (room_id, user_id, name, seat)
  values (v_room.id, v_uid, v_name, 0) returning id into v_player;
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code, 'player_id', v_player);
end $$;

create function public.join_room(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_room public.rooms; v_player uuid;
        v_name text := trim(p_name); v_seat int;
begin
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'room_not_found'; end if;
  select id into v_player from public.room_players where room_id = v_room.id and user_id = v_uid;
  if found then
    return jsonb_build_object('room_id', v_room.id, 'code', v_room.code, 'player_id', v_player);
  end if;
  if v_room.status <> 'lobby' then raise exception 'game_already_started'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.room_players where room_id = v_room.id) >= 20 then
    raise exception 'room_full';
  end if;
  if exists (select 1 from public.room_players where room_id = v_room.id and lower(name) = lower(v_name)) then
    raise exception 'name_taken';
  end if;
  select coalesce(max(seat), -1) + 1 into v_seat from public.room_players where room_id = v_room.id;
  insert into public.room_players (room_id, user_id, name, seat)
  values (v_room.id, v_uid, v_name, v_seat) returning id into v_player;
  perform public._touch(v_room.id);
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code, 'player_id', v_player);
end $$;

create function public.add_local_player(p_room uuid, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room); v_name text := trim(p_name); v_seat int; v_id uuid;
begin
  if r.status <> 'lobby' then raise exception 'game_already_started'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.room_players where room_id = r.id) >= 20 then raise exception 'room_full'; end if;
  if exists (select 1 from public.room_players where room_id = r.id and lower(name) = lower(v_name)) then
    raise exception 'name_taken';
  end if;
  select coalesce(max(seat), -1) + 1 into v_seat from public.room_players where room_id = r.id;
  insert into public.room_players (room_id, name, seat, is_local, user_id)
  values (r.id, v_name, v_seat, true, null) returning id into v_id;
  perform public._touch(r.id);
  return v_id;
end $$;

create function public.remove_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); p public.room_players; r public.rooms;
begin
  select * into p from public.room_players where id = p_player;
  if not found then return; end if;
  select * into r from public.rooms where id = p.room_id for update;
  if r.status <> 'lobby' then raise exception 'game_already_started'; end if;
  if p.user_id = r.host_id then raise exception 'cannot_remove_host'; end if;
  if not (r.host_id = v_uid or p.user_id = v_uid) then raise exception 'forbidden'; end if;
  delete from public.room_players where id = p_player;
  perform public._touch(r.id);
end $$;

create function public.update_settings(p_room uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room); s jsonb;
begin
  if r.status <> 'lobby' then raise exception 'game_already_started'; end if;
  s := r.settings || coalesce(p_settings, '{}'::jsonb);
  if (s ->> 'undercovers')::int not between 1 and 5 then raise exception 'invalid_settings'; end if;
  if (s ->> 'debate_seconds')::int not between 30 and 900 then raise exception 'invalid_settings'; end if;
  if jsonb_typeof(s -> 'mr_white') <> 'boolean' then raise exception 'invalid_settings'; end if;
  update public.rooms set settings = jsonb_build_object(
    'undercovers', (s ->> 'undercovers')::int,
    'mr_white', (s ->> 'mr_white')::boolean,
    'debate_seconds', (s ->> 'debate_seconds')::int,
    'lang', coalesce(s ->> 'lang', 'fr'),
    'category', s -> 'category'
  ), updated_at = now() where id = r.id;
end $$;

-- ---------- Cycle de jeu ---------------------------------------------
create function public._reset_players(p_room uuid) returns void language sql as $$
  update public.room_players
     set alive = true, ready = false, has_voted = false, revealed_role = null
   where room_id = p_room;
$$;

create function public.start_game(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rooms := public._host_room(p_room);
  n int; v_under int; v_white boolean; v_pair public.word_pairs; v_swap boolean;
  v_ids uuid[]; v_starters uuid[]; i int; v_role text;
begin
  if r.status not in ('lobby') then raise exception 'bad_status'; end if;
  select array_agg(id order by random()) into v_ids from public.room_players where room_id = r.id;
  n := coalesce(array_length(v_ids, 1), 0);
  v_under := (r.settings ->> 'undercovers')::int;
  v_white := (r.settings ->> 'mr_white')::boolean;
  if n < 3 then raise exception 'not_enough_players'; end if;
  if n - v_under - (case when v_white then 1 else 0 end) <= v_under + (case when v_white then 1 else 0 end) then
    raise exception 'too_many_impostors';
  end if;

  select * into v_pair from public.word_pairs w
   where w.approved and w.lang = coalesce(r.settings ->> 'lang', 'fr')
     and (r.settings -> 'category' = 'null'::jsonb or r.settings ->> 'category' is null
          or w.category = r.settings ->> 'category')
     and not (w.id = any (r.used_pairs))
   order by random() limit 1;
  if not found then  -- toutes les paires de la sélection ont déjà été jouées : on recommence
    select * into v_pair from public.word_pairs w
     where w.approved and w.lang = coalesce(r.settings ->> 'lang', 'fr')
       and (r.settings -> 'category' = 'null'::jsonb or r.settings ->> 'category' is null
            or w.category = r.settings ->> 'category')
     order by random() limit 1;
    r.used_pairs := '{}';
  end if;
  if not found then raise exception 'no_words'; end if;

  v_swap := random() < 0.5;
  delete from public.player_secrets where player_id in (select id from public.room_players where room_id = r.id);
  delete from public.votes where room_id = r.id;
  insert into public.room_secrets (room_id, civil_word, undercover_word)
  values (r.id,
          case when v_swap then v_pair.undercover_word else v_pair.civil_word end,
          case when v_swap then v_pair.civil_word else v_pair.undercover_word end)
  on conflict (room_id) do update
    set civil_word = excluded.civil_word, undercover_word = excluded.undercover_word;

  for i in 1..n loop
    if i <= v_under then v_role := 'undercover';
    elsif v_white and i = v_under + 1 then v_role := 'mrwhite';
    else v_role := 'civil'; end if;
    insert into public.player_secrets (player_id, role, word)
    values (v_ids[i], v_role,
      case v_role
        when 'civil' then (select civil_word from public.room_secrets where room_id = r.id)
        when 'undercover' then (select undercover_word from public.room_secrets where room_id = r.id)
        else null end);
  end loop;

  perform public._reset_players(r.id);
  select array_agg(p.id) into v_starters
    from public.room_players p join public.player_secrets s on s.player_id = p.id
   where p.room_id = r.id and s.role <> 'mrwhite';

  update public.rooms set
    status = 'reveal', round = 1, phase_ends_at = null, winner = null, last_eliminated_id = null,
    starter_id = v_starters[1 + floor(random() * array_length(v_starters, 1))::int],
    used_pairs = array_append(r.used_pairs, v_pair.id), updated_at = now()
  where id = r.id;
end $$;

create function public.get_my_secret(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.player_secrets; v_status text;
begin
  if not public._can_act(p_player) then raise exception 'forbidden'; end if;
  select r.status into v_status from public.room_players p join public.rooms r on r.id = p.room_id where p.id = p_player;
  if v_status = 'lobby' then raise exception 'bad_status'; end if;
  select * into s from public.player_secrets where player_id = p_player;
  if not found then raise exception 'no_secret'; end if;
  return jsonb_build_object('role', s.role, 'word', s.word);
end $$;

create function public.mark_ready(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_room uuid;
begin
  if not public._can_act(p_player) then raise exception 'forbidden'; end if;
  select room_id into v_room from public.room_players where id = p_player;
  if (select status from public.rooms where id = v_room) <> 'reveal' then raise exception 'bad_status'; end if;
  update public.room_players set ready = true where id = p_player;
  perform public._touch(v_room);
end $$;

create function public.begin_debate(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room);
begin
  if r.status <> 'reveal' then raise exception 'bad_status'; end if;
  if exists (select 1 from public.room_players where room_id = r.id and not ready) then
    raise exception 'players_not_ready';
  end if;
  update public.room_players set ready = false where room_id = r.id;
  update public.rooms set status = 'debate',
    phase_ends_at = now() + make_interval(secs => (r.settings ->> 'debate_seconds')::int),
    updated_at = now() where id = r.id;
end $$;

create function public.extend_debate(p_room uuid, p_seconds int default 60) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room);
begin
  if r.status <> 'debate' then raise exception 'bad_status'; end if;
  update public.rooms set
    phase_ends_at = greatest(phase_ends_at, now()) + make_interval(secs => least(greatest(p_seconds, 10), 300)),
    updated_at = now() where id = r.id;
end $$;

-- L'hôte peut lancer le vote quand il veut ; n'importe quel membre le peut une fois le chrono écoulé.
create function public.start_vote(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; v_uid uuid := public._uid();
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status <> 'debate' then return; end if;
  if r.host_id <> v_uid then
    if not public.is_room_member(r.id) then raise exception 'forbidden'; end if;
    if now() < r.phase_ends_at then raise exception 'too_early'; end if;
  end if;
  update public.room_players set has_voted = false where room_id = r.id;
  delete from public.votes where room_id = r.id and round = r.round;
  update public.rooms set status = 'vote', phase_ends_at = null, updated_at = now() where id = r.id;
end $$;

create function public._winner(p_room uuid) returns text language sql stable as $$
  with c as (
    select
      count(*) filter (where s.role = 'civil')                  as civils,
      count(*) filter (where s.role in ('undercover','mrwhite')) as impostors
    from public.room_players p join public.player_secrets s on s.player_id = p.id
    where p.room_id = p_room and p.alive
  )
  select case when impostors = 0 then 'civils'
              when impostors >= civils then 'impostors'
              else null end from c;
$$;

create function public._finish(p_room uuid, p_winner text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.room_players p set revealed_role = s.role
    from public.player_secrets s where s.player_id = p.id and p.room_id = p_room;
  update public.rooms set status = 'finished', winner = p_winner, phase_ends_at = null, updated_at = now()
   where id = p_room;
  update public.profiles pr set games_played = games_played + 1,
         games_won = games_won + (case when
           (p_winner = 'civils' and s.role = 'civil') or
           (p_winner = 'impostors' and s.role in ('undercover','mrwhite')) or
           (p_winner = 'mrwhite' and s.role = 'mrwhite') then 1 else 0 end)
    from public.room_players p join public.player_secrets s on s.player_id = p.id
   where p.room_id = p_room and p.user_id = pr.id;
end $$;

create function public._after_elimination(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_win text := public._winner(p_room);
begin
  if v_win is not null then perform public._finish(p_room, v_win);
  else update public.rooms set status = 'result', updated_at = now() where id = p_room; end if;
end $$;

create function public._resolve(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; v_top int; v_tied int; v_target uuid; v_role text;
begin
  select * into r from public.rooms where id = p_room for update;
  with t as (select target_id, count(*) c from public.votes where room_id = r.id and round = r.round group by target_id)
  select max(c), count(*) filter (where c = (select max(c) from t)) into v_top, v_tied from t;
  if v_top is null or v_tied > 1 then  -- égalité : personne ne sort
    update public.rooms set status = 'result', last_eliminated_id = null, updated_at = now() where id = r.id;
    return;
  end if;
  select target_id into v_target from public.votes
   where room_id = r.id and round = r.round group by target_id order by count(*) desc limit 1;
  select role into v_role from public.player_secrets where player_id = v_target;
  update public.room_players set alive = false, revealed_role = v_role where id = v_target;
  update public.rooms set last_eliminated_id = v_target, updated_at = now() where id = r.id;
  if v_role = 'mrwhite' then
    update public.rooms set status = 'mrwhite' where id = r.id;   -- dernière chance : deviner le mot
  else
    perform public._after_elimination(r.id);
  end if;
end $$;

create function public.cast_vote(p_voter uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; v public.room_players;
begin
  if not public._can_act(p_voter) then raise exception 'forbidden'; end if;
  select * into v from public.room_players where id = p_voter;
  select * into r from public.rooms where id = v.room_id for update;
  if r.status <> 'vote' then raise exception 'bad_status'; end if;
  if not v.alive then raise exception 'eliminated'; end if;
  if p_voter = p_target then raise exception 'cannot_vote_self'; end if;
  if not exists (select 1 from public.room_players where id = p_target and room_id = r.id and alive) then
    raise exception 'invalid_target';
  end if;
  insert into public.votes (voter_id, target_id, room_id, round) values (p_voter, p_target, r.id, r.round)
  on conflict (voter_id, round) do update set target_id = excluded.target_id;
  update public.room_players set has_voted = true where id = p_voter;
  perform public._touch(r.id);
  if not exists (select 1 from public.room_players where room_id = r.id and alive and not has_voted) then
    perform public._resolve(r.id);
  end if;
end $$;

create function public.force_resolve(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room);
begin
  if r.status <> 'vote' then raise exception 'bad_status'; end if;
  perform public._resolve(r.id);
end $$;

create function public.mrwhite_guess(p_room uuid, p_guess text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rooms; v_civil text; v_ok boolean;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status <> 'mrwhite' then raise exception 'bad_status'; end if;
  if not public._can_act(r.last_eliminated_id) then raise exception 'forbidden'; end if;
  select civil_word into v_civil from public.room_secrets where room_id = r.id;
  v_ok := public._norm(p_guess) = public._norm(v_civil) and public._norm(p_guess) <> '';
  if v_ok then perform public._finish(r.id, 'mrwhite');
  else perform public._after_elimination(r.id); end if;
  return v_ok;
end $$;

create function public.next_round(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room); v_starter uuid;
begin
  if r.status <> 'result' then raise exception 'bad_status'; end if;
  select p.id into v_starter from public.room_players p join public.player_secrets s on s.player_id = p.id
   where p.room_id = r.id and p.alive and s.role <> 'mrwhite' order by random() limit 1;
  if v_starter is null then
    select id into v_starter from public.room_players where room_id = r.id and alive order by random() limit 1;
  end if;
  update public.room_players set has_voted = false where room_id = r.id;
  update public.rooms set status = 'debate', round = round + 1, starter_id = v_starter,
    phase_ends_at = now() + make_interval(secs => (r.settings ->> 'debate_seconds')::int),
    updated_at = now() where id = r.id;
end $$;

create function public.get_reveal(p_room uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rooms; s public.room_secrets;
begin
  select * into r from public.rooms where id = p_room;
  if not found or not public.is_room_member(p_room) then raise exception 'forbidden'; end if;
  if r.status <> 'finished' then raise exception 'bad_status'; end if;
  select * into s from public.room_secrets where room_id = p_room;
  return jsonb_build_object('civil_word', s.civil_word, 'undercover_word', s.undercover_word);
end $$;

create function public.play_again(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms := public._host_room(p_room);
begin
  if r.status <> 'finished' then raise exception 'bad_status'; end if;
  delete from public.player_secrets where player_id in (select id from public.room_players where room_id = r.id);
  delete from public.votes where room_id = r.id;
  perform public._reset_players(r.id);
  update public.rooms set status = 'lobby', round = 0, winner = null, starter_id = null,
    last_eliminated_id = null, phase_ends_at = null, updated_at = now() where id = r.id;
end $$;

-- ---------- Droits d'exécution ---------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_room(text), public.join_room(text, text), public.add_local_player(uuid, text),
  public.remove_player(uuid), public.update_settings(uuid, jsonb), public.start_game(uuid),
  public.get_my_secret(uuid), public.mark_ready(uuid), public.begin_debate(uuid),
  public.extend_debate(uuid, int), public.start_vote(uuid), public.cast_vote(uuid, uuid),
  public.force_resolve(uuid), public.mrwhite_guess(uuid, text), public.next_round(uuid),
  public.get_reveal(uuid), public.play_again(uuid)
to authenticated;
-- les policies RLS appellent is_room_member : droit nécessaire
grant execute on function public.is_room_member(uuid) to authenticated;
