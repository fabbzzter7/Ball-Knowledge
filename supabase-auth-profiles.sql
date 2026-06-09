-- Football Quiz launch auth/profile migration
-- Run in Supabase SQL Editor after taking a backup.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists username text,
  add column if not exists username_normalized text,
  add column if not exists display_name text,
  add column if not exists avatar_emoji text default '⚽',
  add column if not exists avatar_icon text default '⚽',
  add column if not exists avatar_style text default 'classic',
  add column if not exists avatar_color text default 'green',
  add column if not exists avatar_bg text default 'dark',
  add column if not exists favorite_country text default 'Argentina',
  add column if not exists favorite_flag text default '🇦🇷',
  add column if not exists best_score integer default 0,
  add column if not exists coins integer default 0,
  add column if not exists daily_streak integer default 0,
  add column if not exists multiplayer_wins integer default 0,
  add column if not exists multiplayer_losses integer default 0,
  add column if not exists multiplayer_draws integer default 0,
  add column if not exists multiplayer_matches integer default 0,
  add column if not exists xp_total integer default 0,
  add column if not exists level_id integer default 1,
  add column if not exists level_up_claimed_ids jsonb default '[]'::jsonb,
  add column if not exists progression_stats jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.profiles
set
  username = coalesce(nullif(username, ''), display_name, 'player_' || left(id::text, 8)),
  display_name = coalesce(nullif(display_name, ''), username, 'Player'),
  username_normalized = lower(coalesce(nullif(username, ''), display_name, 'player_' || left(id::text, 8)))
where username_normalized is null or username_normalized = '';

create unique index if not exists profiles_username_normalized_unique
  on public.profiles (username_normalized)
  where username_normalized is not null;

-- Enforce auth-user ownership for new launch accounts.
-- If this fails because profiles.id is not uuid, stop and migrate old data first.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_auth_users_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Profiles are publicly readable"
  on public.profiles
  for select
  using (true);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  clean_username text;
begin
  raw_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1),
    'player_' || left(new.id::text, 8)
  );
  clean_username := left(regexp_replace(trim(raw_username), '\s+', '_', 'g'), 18);

  insert into public.profiles (
    id,
    username,
    username_normalized,
    display_name,
    avatar_emoji,
    avatar_icon,
    avatar_style,
    avatar_color,
    avatar_bg,
    favorite_country,
    favorite_flag,
    best_score,
    coins,
    daily_streak,
    xp_total,
    level_id,
    progression_stats
  )
  values (
    new.id,
    clean_username,
    lower(clean_username),
    clean_username,
    '⚽',
    '⚽',
    'classic',
    'green',
    'dark',
    'Argentina',
    '🇦🇷',
    0,
    0,
    0,
    0,
    1,
    '{}'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
