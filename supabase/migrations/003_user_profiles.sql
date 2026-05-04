-- ============================================================
-- 003 – User Profiles  (AgriEvidence)
-- Extended agriculture context per authenticated user.
-- Depends on: 002_core_tables.sql
-- ============================================================

-- ---------------------------------------------------------------
-- Shared trigger function: auto-update updated_at column
-- (created here; reused by later migrations)
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- USER PROFILES
-- ---------------------------------------------------------------
create table if not exists public.user_profiles (
  id                    uuid        primary key references auth.users(id) on delete cascade,
  full_name             text,
  avatar_url            text,
  bio                   text,

  -- Agriculture context (personalisation)
  -- Allowed: crop_farming | livestock | horticulture | aquaculture |
  --          viticulture  | agroforestry | beekeeping | mixed
  farm_types            text[]      not null default '{}',

  -- e.g. ['wheat','corn','coffee','cacao','tomato']
  primary_crops         text[]      not null default '{}',

  farm_size_ha          numeric,

  -- ISO 3166-1 alpha-2  (US, BR, IN, NG, KE …)
  country_code          text,

  -- Sub-national region / state
  region                text,

  -- tropical | subtropical | temperate | arid | semi_arid | mediterranean
  climate_zone          text,

  -- ISO 639-1 language code
  preferred_language    text        not null default 'en',

  -- Subscription & usage limits
  subscription_tier     text        not null default 'free'
                        check (subscription_tier in ('free', 'pro', 'enterprise')),
  searches_this_month   integer     not null default 0,
  monthly_search_limit  integer     not null default 20,

  -- Onboarding wizard state
  onboarding_completed  boolean     not null default false,
  last_seen_at          timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "profiles_select_own" on public.user_profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.user_profiles
  for update using (auth.uid() = id);

grant select, insert, update on public.user_profiles to authenticated;

-- Auto-update updated_at
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------
-- Auto-create profile row immediately after sign-up
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
