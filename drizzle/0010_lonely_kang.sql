DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_select_policy'
  ) THEN
    CREATE POLICY "feedback_select_policy" ON "feedback" AS PERMISSIVE FOR SELECT TO public USING (true);
  END IF;
END $$;
