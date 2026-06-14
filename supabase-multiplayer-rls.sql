alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.multiplayer_rounds enable row level security;

drop policy if exists "matches_insert_own" on public.matches;
drop policy if exists "matches_select_participant_or_waiting_public" on public.matches;
drop policy if exists "matches_update_participant_or_join_waiting_public" on public.matches;
drop policy if exists "matches_delete_participant" on public.matches;

create policy "matches_insert_own"
on public.matches
for insert
to authenticated
with check (auth.uid() = player1_id);

create policy "matches_select_participant_or_waiting_public"
on public.matches
for select
to authenticated
using (
  auth.uid() = player1_id
  or auth.uid() = player2_id
  or (
    is_public = true
    and player2_id is null
    and status = 'waiting_for_opponent'
  )
  or (
    player2_id is null
    and phase in ('waiting_for_opponent', 'choose_category', 'round_active')
    and status in ('waiting', 'waiting_for_opponent', 'active')
  )
);

create policy "matches_update_participant_or_join_waiting_public"
on public.matches
for update
to authenticated
using (
  auth.uid() = player1_id
  or auth.uid() = player2_id
  or (
    is_public = true
    and player2_id is null
    and status = 'waiting_for_opponent'
  )
  or (
    player2_id is null
    and phase in ('waiting_for_opponent', 'choose_category', 'round_active')
    and status in ('waiting', 'waiting_for_opponent', 'active')
  )
)
with check (
  auth.uid() = player1_id
  or auth.uid() = player2_id
);

create policy "matches_delete_participant"
on public.matches
for delete
to authenticated
using (
  auth.uid() = player1_id
  or auth.uid() = player2_id
);

drop policy if exists "match_players_insert_self" on public.match_players;
drop policy if exists "match_players_select_participant" on public.match_players;
drop policy if exists "match_players_update_self" on public.match_players;
drop policy if exists "match_players_delete_participant" on public.match_players;

create policy "match_players_insert_self"
on public.match_players
for insert
to authenticated
with check (auth.uid() = player_id);

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

create policy "match_players_update_self"
on public.match_players
for update
to authenticated
using (auth.uid() = player_id)
with check (auth.uid() = player_id);

create policy "match_players_delete_participant"
on public.match_players
for delete
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

drop policy if exists "multiplayer_rounds_insert_participant" on public.multiplayer_rounds;
drop policy if exists "multiplayer_rounds_select_participant" on public.multiplayer_rounds;
drop policy if exists "multiplayer_rounds_update_participant" on public.multiplayer_rounds;
drop policy if exists "multiplayer_rounds_delete_participant" on public.multiplayer_rounds;

create policy "multiplayer_rounds_insert_participant"
on public.multiplayer_rounds
for insert
to authenticated
with check (
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

create policy "multiplayer_rounds_update_participant"
on public.multiplayer_rounds
for update
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
)
with check (
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

create policy "multiplayer_rounds_delete_participant"
on public.multiplayer_rounds
for delete
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
