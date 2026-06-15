DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_select_policy'
  ) THEN
    DROP POLICY "feedback_select_policy" ON "feedback";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_insert_policy'
  ) THEN
    DROP POLICY "feedback_insert_policy" ON "feedback";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'anyone_can_insert_feedback'
  ) THEN
    CREATE POLICY "anyone_can_insert_feedback" ON "feedback"
      AS PERMISSIVE
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;
