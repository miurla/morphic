-- Migration: Create chat history tables for Bulldozer Search
-- Description: Creates tables to store chat conversations and messages
-- Date: 2025-01-08

-- Create conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add comment to table
comment on table public.conversations is 'Chat conversations for Local 825 users';

-- Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add comment to table
comment on table public.messages is 'Chat messages within conversations';

-- Enable Row Level Security
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Create RLS policies for conversations
create policy "Users can view own conversations"
on public.conversations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own conversations"
on public.conversations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own conversations"
on public.conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own conversations"
on public.conversations
for delete
to authenticated
using (auth.uid() = user_id);

-- Create RLS policies for messages
create policy "Users can view messages in own conversations"
on public.messages
for select
to authenticated
using (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

create policy "Users can create messages in own conversations"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

-- Create indexes for better performance
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- Create function to update updated_at timestamp for conversations
create or replace function public.handle_conversation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create trigger to automatically update updated_at for conversations
drop trigger if exists handle_conversations_updated_at on public.conversations;
create trigger handle_conversations_updated_at
  before update on public.conversations
  for each row execute function public.handle_conversation_updated_at(); 