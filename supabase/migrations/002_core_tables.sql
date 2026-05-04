-- ============================================================
-- 002 – Core tables (Morphic base)
-- chats · messages · parts · feedback
-- ============================================================

-- ---------------------------------------------------------------
-- CHATS
-- ---------------------------------------------------------------
create table if not exists public.chats (
  id          text        primary key,
  user_id     text        not null,
  title       text        not null,
  visibility  text        not null default 'private'
                          check (visibility in ('public', 'private')),
  created_at  timestamptz not null default now()
);

alter table public.chats enable row level security;

create policy "chats_select_own_or_public" on public.chats
  for select using (auth.uid()::text = user_id or visibility = 'public');
create policy "chats_insert_own" on public.chats
  for insert with check (auth.uid()::text = user_id);
create policy "chats_update_own" on public.chats
  for update using (auth.uid()::text = user_id);
create policy "chats_delete_own" on public.chats
  for delete using (auth.uid()::text = user_id);

grant select, insert, update, delete on public.chats to authenticated;
grant select on public.chats to anon;

-- ---------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------
create table if not exists public.messages (
  id          text        primary key,
  chat_id     text        not null references public.chats(id) on delete cascade,
  role        text        not null,
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index if not exists messages_chat_id_idx on public.messages (chat_id);

alter table public.messages enable row level security;

create policy "messages_select_via_chat" on public.messages
  for select using (
    exists (
      select 1 from public.chats
      where id = chat_id
        and (auth.uid()::text = user_id or visibility = 'public')
    )
  );
create policy "messages_insert_own" on public.messages
  for insert with check (
    exists (
      select 1 from public.chats
      where id = chat_id and auth.uid()::text = user_id
    )
  );
create policy "messages_update_own" on public.messages
  for update using (
    exists (
      select 1 from public.chats
      where id = chat_id and auth.uid()::text = user_id
    )
  );
create policy "messages_delete_own" on public.messages
  for delete using (
    exists (
      select 1 from public.chats
      where id = chat_id and auth.uid()::text = user_id
    )
  );

grant select, insert, update, delete on public.messages to authenticated;
grant select on public.messages to anon;

-- ---------------------------------------------------------------
-- PARTS  (AI message parts: text, reasoning, tool outputs, etc.)
-- ---------------------------------------------------------------
create table if not exists public.parts (
  id                          text        primary key default gen_random_uuid()::text,
  message_id                  text        not null references public.messages(id) on delete cascade,
  "order"                     integer     not null,
  type                        text        not null,

  -- text part
  text_text                   text,

  -- reasoning part
  reasoning_text              text,

  -- file part
  file_media_type             text,
  file_filename               text,
  file_url                    text,

  -- source-url part
  source_url_source_id        text,
  source_url_url              text,
  source_url_title            text,

  -- source-document part
  source_document_source_id   text,
  source_document_media_type  text,
  source_document_title       text,
  source_document_filename    text,
  source_document_url         text,
  source_document_snippet     text,

  -- tool shared fields
  tool_tool_call_id           text,
  tool_state                  text,
  tool_error_text             text,

  -- tool inputs / outputs (stored as JSONB)
  tool_search_input           jsonb,
  tool_search_output          jsonb,
  tool_fetch_input            jsonb,
  tool_fetch_output           jsonb,
  tool_question_input         jsonb,
  tool_question_output        jsonb,
  "tool_todoWrite_input"      jsonb,
  "tool_todoWrite_output"     jsonb,
  "tool_todoRead_input"       jsonb,
  "tool_todoRead_output"      jsonb,
  tool_dynamic_input          jsonb,
  tool_dynamic_output         jsonb,
  tool_dynamic_name           text,
  tool_dynamic_type           text,

  -- data part
  data_prefix                 text,
  data_content                jsonb,
  data_id                     text,

  -- AI provider metadata
  provider_metadata           jsonb,

  created_at                  timestamptz not null default now()
);

create index if not exists parts_message_id_idx    on public.parts (message_id);
create index if not exists parts_message_order_idx on public.parts (message_id, "order");

alter table public.parts enable row level security;

create policy "parts_select_via_chat" on public.parts
  for select using (
    exists (
      select 1 from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_id
        and (auth.uid()::text = c.user_id or c.visibility = 'public')
    )
  );
create policy "parts_insert_own" on public.parts
  for insert with check (
    exists (
      select 1 from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_id and auth.uid()::text = c.user_id
    )
  );
create policy "parts_delete_own" on public.parts
  for delete using (
    exists (
      select 1 from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_id and auth.uid()::text = c.user_id
    )
  );

grant select, insert, update, delete on public.parts to authenticated;
grant select on public.parts to anon;

-- ---------------------------------------------------------------
-- FEEDBACK  (site-level user feedback)
-- ---------------------------------------------------------------
create table if not exists public.feedback (
  id          text        primary key,
  user_id     text,
  sentiment   text        not null check (sentiment in ('positive', 'neutral', 'negative')),
  message     text        not null,
  page_url    text        not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone (including anon) can submit feedback
create policy "feedback_insert_any"  on public.feedback
  for insert with check (true);
-- Users can only read their own submissions
create policy "feedback_select_own"  on public.feedback
  for select using (auth.uid()::text = user_id);

grant insert on public.feedback to anon;
grant select, insert on public.feedback to authenticated;
