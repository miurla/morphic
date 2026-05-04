-- ============================================================
-- 008 – Alert Subscriptions  (AgriEvidence)
-- Push/email notifications for pest, disease, weather, market events.
-- Depends on: 003_user_profiles.sql (set_updated_at),
--             004_topics.sql
-- ============================================================

create table if not exists public.alert_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,

  name        text        not null,

  -- Alert category
  -- pest | disease | weather | market | regulation | research
  alert_type  text        not null
              check (alert_type in (
                'pest',
                'disease',
                'weather',
                'market',
                'regulation',
                'research'
              )),

  -- Optional topic scope
  topic_id    uuid        references public.topics(id) on delete set null,

  -- Keywords to match against incoming news / reports
  keywords    text[]      not null default '{}',

  -- ISO 3166-1 alpha-2 region filter; empty = global
  regions     text[]      not null default '{}',

  -- Delivery channels  e.g. ['email','push']
  -- Allowed values: email | push | webhook
  channels    text[]      not null default '{email}',

  -- Delivery cadence: immediate | daily | weekly
  frequency   text        not null default 'daily'
              check (frequency in ('immediate', 'daily', 'weekly')),

  -- Webhook endpoint (required when 'webhook' is in channels)
  webhook_url text,

  is_active   boolean     not null default true,
  last_sent_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists alerts_user_idx  on public.alert_subscriptions (user_id);
create index if not exists alerts_type_idx  on public.alert_subscriptions (alert_type);
create index if not exists alerts_topic_idx on public.alert_subscriptions (topic_id);
create index if not exists alerts_active_idx on public.alert_subscriptions (is_active) where is_active = true;

alter table public.alert_subscriptions enable row level security;

create policy "alerts_select_own" on public.alert_subscriptions
  for select using (auth.uid() = user_id);
create policy "alerts_insert_own" on public.alert_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "alerts_update_own" on public.alert_subscriptions
  for update using (auth.uid() = user_id);
create policy "alerts_delete_own" on public.alert_subscriptions
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.alert_subscriptions to authenticated;

create trigger alerts_set_updated_at
  before update on public.alert_subscriptions
  for each row execute procedure public.set_updated_at();
