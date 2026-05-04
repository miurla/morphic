-- ============================================================
-- 005 – Curated Agriculture Knowledge Sources  (AgriEvidence)
-- Trusted domains used to bias and rank search results.
-- Depends on: 003_user_profiles.sql (set_updated_at trigger fn),
--             004_topics.sql
-- ============================================================

-- ---------------------------------------------------------------
-- SOURCES
-- ---------------------------------------------------------------
create table if not exists public.sources (
  id           uuid    primary key default gen_random_uuid(),
  name         text    not null,
  slug         text    not null unique,
  base_url     text    not null,
  domain       text    not null,
  description  text,
  logo_url     text,

  -- research | government | extension | news | database | marketplace
  source_type  text    not null
               check (source_type in (
                 'research',
                 'government',
                 'extension',
                 'news',
                 'database',
                 'marketplace'
               )),

  -- ISO 639-1 codes, e.g. '{en,es,pt}'
  languages    text[]  not null default '{en}',

  -- ISO 3166-1 alpha-2 codes; empty array = global
  regions      text[]  not null default '{}',

  -- 0–100 editorial trust score
  trust_score  integer not null default 70
               check (trust_score between 0 and 100),

  is_active    boolean not null default true,
  is_featured  boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists sources_active_idx    on public.sources (is_active)   where is_active = true;
create index if not exists sources_featured_idx  on public.sources (is_featured) where is_featured = true;
create index if not exists sources_type_idx      on public.sources (source_type);

alter table public.sources enable row level security;

create policy "sources_select_active" on public.sources
  for select using (is_active = true);

grant select on public.sources to authenticated, anon;

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------
-- SOURCE ↔ TOPIC  (many-to-many coverage mapping)
-- ---------------------------------------------------------------
create table if not exists public.source_topics (
  source_id  uuid not null references public.sources(id) on delete cascade,
  topic_id   uuid not null references public.topics(id)  on delete cascade,
  primary key (source_id, topic_id)
);

alter table public.source_topics enable row level security;

create policy "source_topics_select" on public.source_topics
  for select using (true);

grant select on public.source_topics to authenticated, anon;
