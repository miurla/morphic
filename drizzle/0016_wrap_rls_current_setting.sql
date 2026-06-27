-- Custom SQL migration file, put your code below! --

-- Wrap current_setting('app.current_user_id', true) in (select ...) in the per-user RLS
-- policies so Postgres evaluates it once per statement (an InitPlan) instead of once per
-- row. Predicate-equivalent (row visibility unchanged) -- it only changes when the value
-- is computed. The EXISTS-subquery policies (messages, parts) are intentionally left as-is.
-- Hand-written ALTER POLICY (not drizzle-generated) because the notes/files tables come
-- from raw-SQL migrations 0012/0013 and aren't in the drizzle snapshot, so `drizzle-kit
-- generate` would mis-emit CREATE TABLE/POLICY for them.
ALTER POLICY "users_manage_own_chats" ON "chats" USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
ALTER POLICY "users_manage_own_files" ON "files" USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
ALTER POLICY "users_manage_own_notes" ON "notes" USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
ALTER POLICY "users_anonymize_own_feedback" ON "feedback" USING (user_id = (select current_setting('app.current_user_id', true)));
