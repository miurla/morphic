DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'users_anonymize_own_feedback'
  ) THEN
    CREATE POLICY "users_anonymize_own_feedback" ON "feedback"
      AS PERMISSIVE
      FOR UPDATE
      TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id IS NULL);
  END IF;
END $$;
