-- ============================================================
-- 004 – Agriculture Topic Taxonomy  (AgriEvidence)
-- Hierarchical topic tree for tagging chats and filtering sources.
-- Depends on: 002_core_tables.sql
-- ============================================================

-- ---------------------------------------------------------------
-- TOPICS
-- ---------------------------------------------------------------
create table if not exists public.topics (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,

  -- Localised names for common ag-market languages
  name_es     text,   -- Spanish
  name_fr     text,   -- French
  name_pt     text,   -- Portuguese
  name_ar     text,   -- Arabic
  name_hi     text,   -- Hindi
  name_sw     text,   -- Swahili

  description text,

  -- Self-referential: null = root category
  parent_id   uuid        references public.topics(id) on delete set null,

  icon        text,        -- emoji  e.g. '🌾'
  color       text,        -- hex    e.g. '#4CAF50'
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,

  created_at  timestamptz not null default now()
);

create index if not exists topics_parent_idx  on public.topics (parent_id);
create index if not exists topics_slug_idx    on public.topics (slug);
create index if not exists topics_active_idx  on public.topics (is_active) where is_active = true;

alter table public.topics enable row level security;

-- All active topics are publicly readable
create policy "topics_select_active" on public.topics
  for select using (is_active = true);

grant select on public.topics to authenticated, anon;

-- ---------------------------------------------------------------
-- CHAT ↔ TOPIC  (AI auto-tagging junction)
-- ---------------------------------------------------------------
create table if not exists public.chat_topics (
  chat_id     text        not null references public.chats(id) on delete cascade,
  topic_id    uuid        not null references public.topics(id) on delete cascade,
  -- 0–1 confidence score from the tagging model
  confidence  numeric     check (confidence between 0 and 1),
  primary key (chat_id, topic_id)
);

alter table public.chat_topics enable row level security;

create policy "chat_topics_select" on public.chat_topics
  for select using (
    exists (
      select 1 from public.chats
      where id = chat_id
        and (auth.uid()::text = user_id or visibility = 'public')
    )
  );
create policy "chat_topics_insert_own" on public.chat_topics
  for insert with check (
    exists (
      select 1 from public.chats
      where id = chat_id and auth.uid()::text = user_id
    )
  );
create policy "chat_topics_delete_own" on public.chat_topics
  for delete using (
    exists (
      select 1 from public.chats
      where id = chat_id and auth.uid()::text = user_id
    )
  );

grant select, insert, delete on public.chat_topics to authenticated;
