-- ============================================================
-- 009 – Grant service_role privileges on all public tables
-- ============================================================
-- The admin client (createAdminClient) uses the service_role key,
-- which bypasses RLS but still requires explicit GRANT privileges
-- on each table.  Previous migrations only granted to 'authenticated'
-- and 'anon', causing 42501 permission-denied errors for server-side
-- operations.
-- ============================================================

-- Core tables (002)
grant select, insert, update, delete on public.chats             to service_role;
grant select, insert, update, delete on public.messages          to service_role;
grant select, insert, update, delete on public.parts             to service_role;
grant select, insert, update, delete on public.feedback          to service_role;

-- User profiles (003)
grant select, insert, update, delete on public.user_profiles     to service_role;

-- Topics (004)
grant select, insert, update, delete on public.topics            to service_role;
grant select, insert, update, delete on public.chat_topics       to service_role;

-- Sources (005)
grant select, insert, update, delete on public.sources           to service_role;
grant select, insert, update, delete on public.source_topics     to service_role;

-- Bookmarks / collections (006)
grant select, insert, update, delete on public.collections       to service_role;
grant select, insert, update, delete on public.bookmarks         to service_role;

-- Analytics (007)
grant select, insert, update, delete on public.search_events     to service_role;
grant select, insert, update, delete on public.trending_queries  to service_role;

-- Alerts (008)
grant select, insert, update, delete on public.alert_subscriptions to service_role;
