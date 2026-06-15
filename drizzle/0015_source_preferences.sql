CREATE TABLE IF NOT EXISTS "source_preferences" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "target" text NOT NULL,
  "target_type" varchar(256) NOT NULL,
  "domain" text NOT NULL,
  "preference" varchar(256) NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  CONSTRAINT "source_preferences_target_type_valid" CHECK ("target_type" IN ('domain', 'url')),
  CONSTRAINT "source_preferences_preference_valid" CHECK (
    "preference" IN ('trust', 'prefer', 'mute', 'block')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "source_preferences_user_target_idx" ON "source_preferences" ("user_id", "target");

CREATE INDEX IF NOT EXISTS "source_preferences_user_id_updated_at_idx" ON "source_preferences" ("user_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "source_preferences_user_domain_idx" ON "source_preferences" ("user_id", "domain");

ALTER TABLE "source_preferences" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'source_preferences' AND policyname = 'users_manage_own_source_preferences'
  ) THEN
    CREATE POLICY "users_manage_own_source_preferences" ON "source_preferences"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;
