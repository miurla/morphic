-- ============================================================
-- 006 – Collections & Bookmarks  (AgriEvidence)
-- Users organise saved searches into named collections.
-- Depends on: 002_core_tables.sql, 003_user_profiles.sql
-- ============================================================

-- ---------------------------------------------------------------
-- COLLECTIONS
-- ---------------------------------------------------------------
create table if not exists public.collections (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text,
  icon        text,        -- emoji
  color       text,        -- hex
  is_public   boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists collections_user_idx on public.collections (user_id);

alter table public.collections enable row level security;

create policy "collections_select_own_or_public" on public.collections
  for select using (auth.uid() = user_id or is_public = true);
create policy "collections_insert_own" on public.collections
  for insert with check (auth.uid() = user_id);
create policy "collections_update_own" on public.collections
  for update using (auth.uid() = user_id);
create policy "collections_delete_own" on public.collections
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.collections to authenticated;

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------
-- BOOKMARKS
-- ---------------------------------------------------------------
create table if not exists public.bookmarks (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  collection_id  uuid        references public.collections(id) on delete set null,
  chat_id        text        references public.chats(id) on delete cascade,

  -- Optional: bookmark a stand-alone external URL (no chat)
  url            text,
  title          text,
  description    text,
  thumbnail_url  text,

  notes          text,
  tags           text[]  not null default '{}',
  created_at     timestamptz not null default now(),

  -- At least one of chat_id or url must be set
  constraint bookmarks_has_target check (chat_id is not null or url is not null)
);

create index if not exists bookmarks_user_idx       on public.bookmarks (user_id);
create index if not exists bookmarks_collection_idx on public.bookmarks (collection_id);
create index if not exists bookmarks_chat_idx       on public.bookmarks (chat_id);
create index if not exists bookmarks_tags_idx       on public.bookmarks using gin (tags);

alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own" on public.bookmarks
  for select using (auth.uid() = user_id);
create policy "bookmarks_insert_own" on public.bookmarks
  for insert with check (auth.uid() = user_id);
create policy "bookmarks_update_own" on public.bookmarks
  for update using (auth.uid() = user_id);
create policy "bookmarks_delete_own" on public.bookmarks
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.bookmarks to authenticated;
