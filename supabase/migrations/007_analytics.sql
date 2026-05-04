-- ============================================================
-- 007 – Search Analytics  (AgriEvidence)
-- Append-only event log + materialised trending queries.
-- Depends on: 001_extensions.sql (pg_trgm), 002_core_tables.sql,
--             004_topics.sql
-- ============================================================

-- ---------------------------------------------------------------
-- SEARCH EVENTS  (append-only — no UPDATE / DELETE policies)
-- ---------------------------------------------------------------
create table if not exists public.search_events (
  id              uuid        primary key default gen_random_uuid(),

  -- Nullable: anonymous sessions are allowed
  user_id         uuid        references auth.users(id) on delete set null,

  -- The raw query string
  query           text        not null,

  -- Linked chat (if search came from a chat session)
  chat_id         text        references public.chats(id) on delete set null,

  -- AI-assigned topics at query time
  topic_ids       uuid[]      not null default '{}',

  -- Selected search providers  e.g. ['tavily','brave']
  providers_used  text[]      not null default '{}',

  -- Number of sources returned
  result_count    integer,

  -- Latency in milliseconds
  latency_ms      integer,

  -- ISO 3166-1 alpha-2 origin country (from IP geo)
  country_code    text,

  -- User agent / device context
  platform        text,

  -- Did user click any result?
  has_engagement  boolean     not null default false,

  created_at      timestamptz not null default now()
);

-- Trigram index for fuzzy trending-query aggregation
create index if not exists search_events_query_trgm_idx
  on public.search_events using gin (query gin_trgm_ops);

-- Fast time-range aggregations
create index if not exists search_events_created_at_idx
  on public.search_events (created_at desc);

-- Filter by user
create index if not exists search_events_user_idx
  on public.search_events (user_id);

-- Filter by topic
create index if not exists search_events_topics_gin_idx
  on public.search_events using gin (topic_ids);

alter table public.search_events enable row level security;

-- Users can see only their own events
create policy "search_events_select_own" on public.search_events
  for select using (auth.uid() = user_id);

-- Anyone (incl. anon via service role) can insert
create policy "search_events_insert_any" on public.search_events
  for insert with check (true);

-- NO UPDATE / DELETE — append-only for analytics integrity

grant insert on public.search_events to anon;
grant select, insert on public.search_events to authenticated;

-- ---------------------------------------------------------------
-- TRENDING QUERIES  (pre-aggregated, refreshed by cron/edge fn)
-- ---------------------------------------------------------------
create table if not exists public.trending_queries (
  id            uuid    primary key default gen_random_uuid(),
  query         text    not null,
  topic_id      uuid    references public.topics(id) on delete set null,

  -- daily | weekly | monthly
  period        text    not null default 'daily'
                check (period in ('daily', 'weekly', 'monthly')),

  query_count   integer not null default 0,
  country_code  text,
  computed_at   timestamptz not null default now()
);

create index if not exists trending_period_idx  on public.trending_queries (period);
create index if not exists trending_topic_idx   on public.trending_queries (topic_id);
create index if not exists trending_count_idx   on public.trending_queries (query_count desc);

alter table public.trending_queries enable row level security;

create policy "trending_select_all" on public.trending_queries
  for select using (true);

grant select on public.trending_queries to authenticated, anon;
