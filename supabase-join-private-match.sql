-- Ball Knowledge private H2H join fix.
-- Apply this file by itself after reviewing it in Supabase SQL Editor.
-- It intentionally adds only the narrow private room-code join RPC.

begin;

create or replace function public.join_private_match_by_room_code(
  p_room_code text
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_uid_text text;
  v_room_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_room_code, '')));
  v_claims jsonb := '{}'::jsonb;
  v_username text;
  v_match public.matches%rowtype;
  v_candidate public.matches%rowtype;
  v_joined_match public.matches%rowtype;
  v_match_count integer := 0;
  v_should_keep_active_round boolean;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  v_uid_text := v_uid::text;

  if v_room_code !~ '^BK-[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'invalid_room_code';
  end if;

  begin
    v_claims := coalesce(
      nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb,
      '{}'::jsonb
    );
  exception
    when others then
      v_claims := '{}'::jsonb;
  end;

  select coalesce(
    nullif(pg_catalog.btrim(public.profiles.display_name), ''),
    nullif(pg_catalog.btrim(public.profiles.username), '')
  )
  into v_username
  from public.profiles
  where public.profiles.id = v_uid_text;

  v_username := coalesce(
    v_username,
    nullif(pg_catalog.btrim(v_claims #>> '{user_metadata,display_name}'), ''),
    nullif(pg_catalog.btrim(v_claims #>> '{user_metadata,username}'), ''),
    'Guest'
  );

  for v_candidate in
    select *
    from public.matches
    where pg_catalog.upper(pg_catalog.btrim(public.matches.room_code)) = v_room_code
      and coalesce(public.matches.is_public, false) = false
      and coalesce(public.matches.status, '') <> 'completed'
      and coalesce(public.matches.phase, '') <> 'completed'
    order by public.matches.created_at asc nulls last
    for update
  loop
    v_match_count := v_match_count + 1;
    v_match := v_candidate;
  end loop;

  if v_match_count = 0 then
    if exists (
      select 1
      from public.matches
      where pg_catalog.upper(pg_catalog.btrim(public.matches.room_code)) = v_room_code
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

  if v_match_count > 1 then
    raise exception using errcode = 'P0001', message = 'room_not_found';
  end if;

  if v_match.player1_id = v_uid_text then
    raise exception using errcode = 'P0001', message = 'own_room';
  end if;

  if v_match.player2_id is not null and v_match.player2_id <> v_uid_text then
    raise exception using errcode = 'P0001', message = 'room_full';
  end if;

  if exists (
    select 1
    from public.match_players
    where public.match_players.match_id = v_match.id
      and public.match_players.player_slot = 'player2'
      and public.match_players.player_id is distinct from v_uid_text
  ) then
    raise exception using errcode = 'P0001', message = 'room_full';
  end if;

  v_should_keep_active_round := v_match.phase = 'round_active';

  if v_match.player2_id = v_uid_text then
    insert into public.match_players (
      match_id,
      username,
      player_id,
      player_slot
    )
    select
      v_match.id,
      v_username,
      v_uid_text,
      'player2'
    where not exists (
      select 1
      from public.match_players
      where public.match_players.match_id = v_match.id
        and public.match_players.player_id = v_uid_text
    );

    return v_match;
  end if;

  if v_match.player2_id is not null or nullif(v_match.player2_username, '') is not null then
    raise exception using errcode = 'P0001', message = 'room_full';
  end if;

  update public.matches
  set
    player2_username = v_username,
    player2_id = v_uid_text,
    status = case
      when v_should_keep_active_round then 'active'
      else 'ready'
    end,
    phase = case
      when v_should_keep_active_round then 'round_active'
      else 'choose_category'
    end,
    current_turn = case
      when v_should_keep_active_round then v_username
      else v_match.player1_username
    end,
    current_turn_id = case
      when v_should_keep_active_round then v_uid_text
      else v_match.player1_id
    end,
    updated_at = pg_catalog.now()
  where public.matches.id = v_match.id
    and public.matches.player2_id is null
    and nullif(public.matches.player2_username, '') is null
    and public.matches.player1_id <> v_uid_text
    and coalesce(public.matches.is_public, false) = false
    and coalesce(public.matches.status, '') <> 'completed'
    and coalesce(public.matches.phase, '') <> 'completed'
  returning *
  into v_joined_match;

  if not found then
    raise exception using errcode = 'P0001', message = 'room_full';
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
    v_uid_text,
    'player2'
  where not exists (
    select 1
    from public.match_players
    where public.match_players.match_id = v_joined_match.id
      and public.match_players.player_id = v_uid_text
  );

  return v_joined_match;
end;
$$;

revoke all on function public.join_private_match_by_room_code(text) from public;
revoke all on function public.join_private_match_by_room_code(text) from anon;
revoke all on function public.join_private_match_by_room_code(text) from authenticated;
grant execute on function public.join_private_match_by_room_code(text) to authenticated;

commit;
