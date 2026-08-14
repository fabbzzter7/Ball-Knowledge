begin;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('matches', 'match_players', 'multiplayer_rounds')
order by tablename, policyname;

select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('matches', 'match_players', 'multiplayer_rounds')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, privilege_type;

select
  table_schema,
  table_name,
  column_name,
  grantee,
  privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('matches', 'match_players', 'multiplayer_rounds')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, column_name, grantee, privilege_type;

alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.multiplayer_rounds enable row level security;

revoke insert, update, delete on public.matches from anon, authenticated, public;
revoke insert, update, delete on public.match_players from anon, authenticated, public;
revoke insert, update, delete on public.multiplayer_rounds from anon, authenticated, public;

do $$
declare
  v_table_name text;
  v_columns text;
begin
  foreach v_table_name in array array['matches', 'match_players', 'multiplayer_rounds']
  loop
    select string_agg(quote_ident(information_schema.columns.column_name), ', ')
    into v_columns
    from information_schema.columns
    where information_schema.columns.table_schema = 'public'
      and information_schema.columns.table_name = v_table_name;

    if v_columns is not null then
      execute format(
        'revoke insert (%s) on table public.%I from anon, authenticated, public',
        v_columns,
        v_table_name
      );
      execute format(
        'revoke update (%s) on table public.%I from anon, authenticated, public',
        v_columns,
        v_table_name
      );
    end if;
  end loop;
end $$;

grant select on public.matches to authenticated;
grant select on public.match_players to authenticated;
grant select on public.multiplayer_rounds to authenticated;

do $$
begin
  if exists (
    select 1
    from public.matches
    where room_code is not null
      and coalesce(status, '') <> 'completed'
      and coalesce(phase, '') <> 'completed'
    group by upper(trim(room_code))
    having count(*) > 1
  ) then
    raise exception 'Cannot create matches_room_code_joinable_unique: duplicate non-completed canonical room_code values exist';
  end if;
end $$;

create unique index if not exists matches_room_code_joinable_unique
on public.matches (upper(trim(room_code)))
where room_code is not null
  and coalesce(status, '') <> 'completed'
  and coalesce(phase, '') <> 'completed';

do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('matches', 'match_players', 'multiplayer_rounds')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end $$;

create policy "matches_select_participant"
on public.matches
for select
to authenticated
using (
  auth.uid() = player1_id
  or auth.uid() = player2_id
);

drop policy if exists "match_players_insert_self" on public.match_players;
drop policy if exists "match_players_select_participant" on public.match_players;
drop policy if exists "match_players_update_self" on public.match_players;
drop policy if exists "match_players_delete_participant" on public.match_players;

create policy "match_players_select_participant"
on public.match_players
for select
to authenticated
using (
  auth.uid() = player_id
  or exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and (
        public.matches.player1_id = auth.uid()
        or public.matches.player2_id = auth.uid()
      )
  )
);

create policy "multiplayer_rounds_select_participant"
on public.multiplayer_rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.matches
    where public.matches.id = public.multiplayer_rounds.match_id
      and (
        public.matches.player1_id = auth.uid()
        or public.matches.player2_id = auth.uid()
      )
  )
);

create or replace function public.create_private_multiplayer_match(
  p_mode text
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_mode text := trim(coalesce(p_mode, ''));
  v_room_code text;
  v_match public.matches%rowtype;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if v_mode not in ('general', 'world_cup', 'premier_league', 'career_path') then
    raise exception using errcode = '22023', message = 'invalid_mode';
  end if;

  select coalesce(
    nullif(trim(public.profiles.display_name), ''),
    nullif(trim(public.profiles.username), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'username'), '')
  )
  into v_username
  from auth.users
  left join public.profiles on public.profiles.id = auth.users.id
  where auth.users.id = v_uid;

  v_username := coalesce(v_username, 'Guest');

  loop
    v_attempt := v_attempt + 1;
    v_room_code := 'BK-' || lpad((floor(pg_catalog.random() * 9000) + 1000)::int::text, 4, '0');

    begin
      insert into public.matches (
        room_code,
        mode,
        created_by,
        current_turn,
        current_turn_id,
        player1_username,
        player1_id,
        status,
        phase,
        round_number,
        is_public,
        updated_at
      )
      values (
        v_room_code,
        v_mode,
        v_username,
        v_username,
        v_uid,
        v_username,
        v_uid,
        'active',
        'choose_category',
        0,
        false,
        pg_catalog.now()
      )
      returning *
      into v_match;

      exit;
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise exception using errcode = '23505', message = 'room_code_unavailable';
        end if;
    end;
  end loop;

  insert into public.match_players (
    match_id,
    username,
    player_id,
    player_slot
  )
  values (
    v_match.id,
    v_username,
    v_uid,
    'player1'
  );

  return v_match;
end;
$$;

revoke all on function public.create_private_multiplayer_match(text) from anon;
revoke all on function public.create_private_multiplayer_match(text) from authenticated;
revoke all on function public.create_private_multiplayer_match(text) from public;
grant execute on function public.create_private_multiplayer_match(text) to authenticated;

create or replace function public.join_private_match_by_room_code(
  p_room_code text,
  p_username text
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room_code text := upper(trim(coalesce(p_room_code, '')));
  v_username text;
  v_match public.matches%rowtype;
  v_joined_match public.matches%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if v_room_code !~ '^BK-[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'invalid_room_code';
  end if;

  select coalesce(
    nullif(trim(public.profiles.display_name), ''),
    nullif(trim(public.profiles.username), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'username'), '')
  )
  into v_username
  from auth.users
  left join public.profiles on public.profiles.id = auth.users.id
  where auth.users.id = v_uid;

  v_username := coalesce(v_username, 'Guest');

  select *
  into v_match
  from public.matches
  where upper(trim(public.matches.room_code)) = v_room_code
    and coalesce(public.matches.is_public, false) = false
    and coalesce(public.matches.status, '') <> 'completed'
    and coalesce(public.matches.phase, '') <> 'completed'
  for update;

  if not found then
    if exists (
      select 1
      from public.matches
      where upper(trim(public.matches.room_code)) = v_room_code
        and coalesce(public.matches.is_public, false) = false
        and (
          public.matches.status = 'completed'
          or public.matches.phase = 'completed'
        )
    ) then
      raise exception using errcode = 'P0001', message = 'room_completed';
    end if;

    raise exception using errcode = 'P0002', message = 'room_not_found';
  end if;

  if v_match.player1_id = v_uid then
    raise exception using errcode = '23505', message = 'own_room';
  end if;

  if v_match.player2_id = v_uid then
    return v_match;
  end if;

  if v_match.player2_id is not null or nullif(v_match.player2_username, '') is not null then
    raise exception using errcode = '23505', message = 'room_full';
  end if;

  update public.matches
  set
    player2_username = v_username,
    player2_id = v_uid,
    status = case
      when v_match.phase = 'round_active' then 'active'
      else 'ready'
    end,
    phase = case
      when v_match.phase = 'round_active' then 'round_active'
      else 'choose_category'
    end,
    current_turn = case
      when v_match.phase = 'round_active' then v_username
      else v_match.player1_username
    end,
    current_turn_id = case
      when v_match.phase = 'round_active' then v_uid
      else v_match.player1_id
    end,
    updated_at = pg_catalog.now()
  where public.matches.id = v_match.id
    and public.matches.player2_id is null
    and nullif(public.matches.player2_username, '') is null
    and public.matches.player1_id <> v_uid
    and coalesce(public.matches.is_public, false) = false
    and coalesce(public.matches.status, '') <> 'completed'
    and coalesce(public.matches.phase, '') <> 'completed'
  returning *
  into v_joined_match;

  if not found then
    raise exception using errcode = '23505', message = 'room_full';
  end if;

  insert into public.match_players (
    match_id,
    username,
    player_id,
    player_slot
  )
  select
    v_joined_match.id,
    v_username,
    v_uid,
    'player2'
  where not exists (
    select 1
    from public.match_players
    where public.match_players.match_id = v_joined_match.id
      and public.match_players.player_id = v_uid
  );

  return v_joined_match;
end;
$$;

revoke all on function public.join_private_match_by_room_code(text, text) from anon;
revoke all on function public.join_private_match_by_room_code(text, text) from authenticated;
revoke all on function public.join_private_match_by_room_code(text, text) from public;
grant execute on function public.join_private_match_by_room_code(text, text) to authenticated;

create or replace function public.create_public_multiplayer_match(
  p_category text,
  p_question_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_category text := trim(coalesce(p_category, ''));
  v_room_code text;
  v_match public.matches%rowtype;
  v_round public.multiplayer_rounds%rowtype;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if v_category not in ('general', 'world_cup', 'premier_league', 'career_path') then
    raise exception using errcode = '22023', message = 'invalid_category';
  end if;

  if jsonb_typeof(p_question_ids) <> 'array' or jsonb_array_length(p_question_ids) <> 5 then
    raise exception using errcode = '22023', message = 'invalid_questions';
  end if;

  select coalesce(
    nullif(trim(public.profiles.display_name), ''),
    nullif(trim(public.profiles.username), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'username'), '')
  )
  into v_username
  from auth.users
  left join public.profiles on public.profiles.id = auth.users.id
  where auth.users.id = v_uid;

  v_username := coalesce(v_username, 'Guest');

  loop
    v_attempt := v_attempt + 1;
    v_room_code := 'BK-' || lpad((floor(pg_catalog.random() * 9000) + 1000)::int::text, 4, '0');

    begin
      insert into public.matches (
        room_code,
        mode,
        selected_category,
        created_by,
        current_turn,
        current_turn_id,
        player1_username,
        player1_id,
        status,
        phase,
        round_number,
        is_public,
        matchmaking_status,
        updated_at
      )
      values (
        v_room_code,
        v_category,
        v_category,
        v_username,
        v_username,
        v_uid,
        v_username,
        v_uid,
        'active',
        'round_active',
        1,
        true,
        'in_progress',
        pg_catalog.now()
      )
      returning *
      into v_match;

      exit;
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise exception using errcode = '23505', message = 'room_code_unavailable';
        end if;
    end;
  end loop;

  insert into public.match_players (
    match_id,
    username,
    player_id,
    player_slot
  )
  values (
    v_match.id,
    v_username,
    v_uid,
    'player1'
  );

  insert into public.multiplayer_rounds (
    match_id,
    round_number,
    category,
    chosen_by,
    question_ids,
    player1_score,
    player2_score,
    player1_finished,
    player2_finished,
    status
  )
  values (
    v_match.id,
    1,
    v_category,
    v_username,
    p_question_ids,
    0,
    0,
    false,
    false,
    'active'
  )
  returning *
  into v_round;

  return jsonb_build_object(
    'match', to_jsonb(v_match),
    'round', to_jsonb(v_round)
  );
end;
$$;

revoke all on function public.create_public_multiplayer_match(text, jsonb) from anon;
revoke all on function public.create_public_multiplayer_match(text, jsonb) from authenticated;
revoke all on function public.create_public_multiplayer_match(text, jsonb) from public;
grant execute on function public.create_public_multiplayer_match(text, jsonb) to authenticated;

create or replace function public.join_public_waiting_match(
  p_username text
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_match public.matches%rowtype;
  v_joined_match public.matches%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select coalesce(
    nullif(trim(public.profiles.display_name), ''),
    nullif(trim(public.profiles.username), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(auth.users.raw_user_meta_data->>'username'), '')
  )
  into v_username
  from auth.users
  left join public.profiles on public.profiles.id = auth.users.id
  where auth.users.id = v_uid;

  v_username := coalesce(v_username, 'Guest');

  select *
  into v_match
  from public.matches
  where coalesce(public.matches.is_public, false) = true
    and public.matches.player2_id is null
    and public.matches.player1_id <> v_uid
    and coalesce(public.matches.status, '') <> 'completed'
    and coalesce(public.matches.phase, '') <> 'completed'
    and (
      (
        public.matches.status = 'waiting_for_opponent'
        and public.matches.matchmaking_status = 'waiting_for_opponent'
      )
      or (
        public.matches.status in ('active', 'waiting')
        and public.matches.phase = 'round_active'
        and public.matches.matchmaking_status in ('in_progress', 'waiting_for_opponent')
      )
    )
  order by public.matches.created_at asc nulls last
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.matches
  set
    player2_username = v_username,
    player2_id = v_uid,
    status = 'active',
    matchmaking_status = 'matched',
    phase = 'round_active',
    current_turn = v_username,
    current_turn_id = v_uid,
    updated_at = pg_catalog.now()
  where public.matches.id = v_match.id
    and public.matches.player2_id is null
    and public.matches.player1_id <> v_uid
    and coalesce(public.matches.is_public, false) = true
    and coalesce(public.matches.status, '') <> 'completed'
    and coalesce(public.matches.phase, '') <> 'completed'
  returning *
  into v_joined_match;

  if not found then
    return null;
  end if;

  insert into public.match_players (
    match_id,
    username,
    player_id,
    player_slot
  )
  select
    v_joined_match.id,
    v_username,
    v_uid,
    'player2'
  where not exists (
    select 1
    from public.match_players
    where public.match_players.match_id = v_joined_match.id
      and public.match_players.player_id = v_uid
  );

  return v_joined_match;
end;
$$;

revoke all on function public.join_public_waiting_match(text) from anon;
revoke all on function public.join_public_waiting_match(text) from authenticated;
revoke all on function public.join_public_waiting_match(text) from public;
grant execute on function public.join_public_waiting_match(text) to authenticated;

create or replace function public.choose_multiplayer_category(
  p_match_id uuid,
  p_category text,
  p_mode text,
  p_question_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_match public.matches%rowtype;
  v_round public.multiplayer_rounds%rowtype;
  v_next_round_number integer;
  v_category text := trim(coalesce(p_category, ''));
  v_mode text := trim(coalesce(p_mode, ''));
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if p_match_id is null then
    raise exception using errcode = '22023', message = 'invalid_match';
  end if;

  if v_category not in ('general', 'world_cup', 'premier_league', 'career_path') then
    raise exception using errcode = '22023', message = 'invalid_category';
  end if;

  if v_mode not in ('general', 'world_cup', 'premier_league', 'career_path') or v_mode <> v_category then
    raise exception using errcode = '22023', message = 'invalid_mode';
  end if;

  if jsonb_typeof(p_question_ids) <> 'array' or jsonb_array_length(p_question_ids) <> 5 then
    raise exception using errcode = '22023', message = 'invalid_questions';
  end if;

  select *
  into v_match
  from public.matches
  where public.matches.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'match_not_found';
  end if;

  if v_match.player1_id <> v_uid and v_match.player2_id <> v_uid then
    raise exception using errcode = '42501', message = 'not_match_participant';
  end if;

  if v_match.current_turn_id <> v_uid then
    raise exception using errcode = '42501', message = 'not_your_turn';
  end if;

  if coalesce(v_match.status, '') = 'completed' or coalesce(v_match.phase, '') = 'completed' then
    raise exception using errcode = 'P0001', message = 'match_completed';
  end if;

  v_username := case
    when v_match.player1_id = v_uid then v_match.player1_username
    when v_match.player2_id = v_uid then v_match.player2_username
    else null
  end;
  v_username := coalesce(nullif(trim(v_username), ''), 'Guest');

  v_next_round_number := coalesce(v_match.round_number, 0) + 1;

  select *
  into v_round
  from public.multiplayer_rounds
  where public.multiplayer_rounds.match_id = v_match.id
    and public.multiplayer_rounds.round_number = v_next_round_number
  order by public.multiplayer_rounds.id
  limit 1;

  if not found then
    insert into public.multiplayer_rounds (
      match_id,
      round_number,
      category,
      chosen_by,
      question_ids,
      player1_score,
      player2_score,
      player1_finished,
      player2_finished,
      status
    )
    values (
      v_match.id,
      v_next_round_number,
      v_category,
      v_username,
      p_question_ids,
      0,
      0,
      false,
      false,
      'active'
    )
    returning *
    into v_round;
  elsif
    v_round.category <> v_category
    or v_round.question_ids <> p_question_ids
  then
    raise exception using errcode = '23505', message = 'round_already_started';
  end if;

  update public.matches
  set
    selected_category = v_round.category,
    mode = v_mode,
    phase = 'round_active',
    round_number = v_round.round_number,
    current_turn = v_username,
    current_turn_id = v_uid,
    updated_at = pg_catalog.now()
  where public.matches.id = v_match.id
  returning *
  into v_match;

  return jsonb_build_object(
    'match', to_jsonb(v_match),
    'round', to_jsonb(v_round)
  );
end;
$$;

revoke all on function public.choose_multiplayer_category(uuid, text, text, jsonb) from anon;
revoke all on function public.choose_multiplayer_category(uuid, text, text, jsonb) from authenticated;
revoke all on function public.choose_multiplayer_category(uuid, text, text, jsonb) from public;
grant execute on function public.choose_multiplayer_category(uuid, text, text, jsonb) to authenticated;

create or replace function public.submit_multiplayer_round_score(
  p_match_id uuid,
  p_round_id uuid,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_round public.multiplayer_rounds%rowtype;
  v_updated_match public.matches%rowtype;
  v_updated_round public.multiplayer_rounds%rowtype;
  v_player_slot text;
  v_username text;
  v_score integer := p_score;
  v_other_finished boolean := false;
  v_player1_score integer;
  v_player2_score integer;
  v_winner text;
  v_winner_slot text;
  v_question_count integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select *
  into v_match
  from public.matches
  where public.matches.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'match_not_found';
  end if;

  if v_match.player1_id = v_uid then
    v_player_slot := 'player1';
    v_username := v_match.player1_username;
  elsif v_match.player2_id = v_uid then
    v_player_slot := 'player2';
    v_username := v_match.player2_username;
  else
    raise exception using errcode = '42501', message = 'not_match_participant';
  end if;

  v_username := coalesce(nullif(trim(v_username), ''), 'Guest');

  select *
  into v_round
  from public.multiplayer_rounds
  where public.multiplayer_rounds.id = p_round_id
    and public.multiplayer_rounds.match_id = v_match.id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'round_not_found';
  end if;

  if jsonb_typeof(v_round.question_ids) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_round_questions';
  end if;

  v_question_count := jsonb_array_length(v_round.question_ids);

  if v_question_count <> 5 then
    raise exception using errcode = '22023', message = 'invalid_round_questions';
  end if;

  if v_score is null or v_score < 0 or v_score > v_question_count then
    raise exception using errcode = '22023', message = 'invalid_score';
  end if;

  if v_player_slot = 'player1' and coalesce(v_round.player1_finished, false) then
    raise exception using errcode = '23505', message = 'round_already_submitted';
  end if;

  if v_player_slot = 'player2' and coalesce(v_round.player2_finished, false) then
    raise exception using errcode = '23505', message = 'round_already_submitted';
  end if;

  v_other_finished := case
    when v_player_slot = 'player1' then coalesce(v_round.player2_finished, false)
    else coalesce(v_round.player1_finished, false)
  end;

  v_player1_score := case
    when v_player_slot = 'player1' then v_score
    else coalesce(v_round.player1_score, 0)
  end;
  v_player2_score := case
    when v_player_slot = 'player2' then v_score
    else coalesce(v_round.player2_score, 0)
  end;

  if v_other_finished then
    if v_player1_score > v_player2_score then
      v_winner := v_match.player1_username;
      v_winner_slot := 'player1';
    elsif v_player2_score > v_player1_score then
      v_winner := v_match.player2_username;
      v_winner_slot := 'player2';
    else
      v_winner := 'draw';
      v_winner_slot := 'draw';
    end if;
  end if;

  if v_player_slot = 'player1' then
    update public.multiplayer_rounds
    set
      player1_score = v_score,
      player1_finished = true,
      winner = case when v_other_finished then v_winner else winner end,
      status = case when v_other_finished then 'finished' else status end
    where public.multiplayer_rounds.id = v_round.id
    returning *
    into v_updated_round;
  else
    update public.multiplayer_rounds
    set
      player2_score = v_score,
      player2_finished = true,
      winner = case when v_other_finished then v_winner else winner end,
      status = case when v_other_finished then 'finished' else status end
    where public.multiplayer_rounds.id = v_round.id
    returning *
    into v_updated_round;
  end if;

  if v_other_finished then
    update public.matches
    set
      status = 'active',
      phase = 'round_finished',
      matchmaking_status = case
        when coalesce(v_match.is_public, false) then 'matched'
        else v_match.matchmaking_status
      end,
      current_turn = v_username,
      current_turn_id = v_uid,
      player1_wins = case
        when v_winner_slot = 'player1' then coalesce(v_match.player1_wins, 0) + 1
        else v_match.player1_wins
      end,
      player2_wins = case
        when v_winner_slot = 'player2' then coalesce(v_match.player2_wins, 0) + 1
        else v_match.player2_wins
      end,
      updated_at = pg_catalog.now()
    where public.matches.id = v_match.id
    returning *
    into v_updated_match;
  elsif coalesce(v_match.is_public, false) and v_match.player2_id is null then
    update public.matches
    set
      status = 'waiting_for_opponent',
      phase = 'waiting_for_opponent',
      matchmaking_status = 'waiting_for_opponent',
      current_turn = null,
      current_turn_id = null,
      updated_at = pg_catalog.now()
    where public.matches.id = v_match.id
    returning *
    into v_updated_match;
  elsif coalesce(v_match.is_public, false) then
    update public.matches
    set
      status = 'active',
      phase = 'round_active',
      matchmaking_status = 'matched',
      current_turn = case
        when v_player_slot = 'player1' then v_match.player2_username
        else v_match.player1_username
      end,
      current_turn_id = case
        when v_player_slot = 'player1' then v_match.player2_id
        else v_match.player1_id
      end,
      updated_at = pg_catalog.now()
    where public.matches.id = v_match.id
    returning *
    into v_updated_match;
  elsif v_player_slot = 'player1' and v_match.player2_id is null then
    update public.matches
    set
      status = 'waiting',
      phase = 'round_active',
      current_turn = null,
      current_turn_id = null,
      updated_at = pg_catalog.now()
    where public.matches.id = v_match.id
    returning *
    into v_updated_match;
  else
    update public.matches
    set
      current_turn = case
        when v_player_slot = 'player1' then v_match.player2_username
        else v_match.player1_username
      end,
      current_turn_id = case
        when v_player_slot = 'player1' then v_match.player2_id
        else v_match.player1_id
      end,
      updated_at = pg_catalog.now()
    where public.matches.id = v_match.id
    returning *
    into v_updated_match;
  end if;

  return jsonb_build_object(
    'match', to_jsonb(v_updated_match),
    'round', to_jsonb(v_updated_round),
    'player_slot', v_player_slot,
    'winner_slot', v_winner_slot,
    'winner_player_id', case
      when v_winner_slot = 'player1' then v_match.player1_id
      when v_winner_slot = 'player2' then v_match.player2_id
      else null
    end
  );
end;
$$;

revoke all on function public.submit_multiplayer_round_score(uuid, uuid, integer) from anon;
revoke all on function public.submit_multiplayer_round_score(uuid, uuid, integer) from authenticated;
revoke all on function public.submit_multiplayer_round_score(uuid, uuid, integer) from public;
grant execute on function public.submit_multiplayer_round_score(uuid, uuid, integer) to authenticated;

create or replace function public.delete_multiplayer_match(
  p_match_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select *
  into v_match
  from public.matches
  where public.matches.id = p_match_id
  for update;

  if not found then
    return false;
  end if;

  if v_match.player1_id <> v_uid then
    raise exception using errcode = '42501', message = 'not_match_host';
  end if;

  delete from public.multiplayer_rounds
  where public.multiplayer_rounds.match_id = v_match.id;

  delete from public.match_players
  where public.match_players.match_id = v_match.id;

  delete from public.matches
  where public.matches.id = v_match.id;

  return true;
end;
$$;

revoke all on function public.delete_multiplayer_match(uuid) from anon;
revoke all on function public.delete_multiplayer_match(uuid) from authenticated;
revoke all on function public.delete_multiplayer_match(uuid) from public;
grant execute on function public.delete_multiplayer_match(uuid) to authenticated;

commit;
