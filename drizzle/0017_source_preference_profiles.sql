CREATE TABLE IF NOT EXISTS "source_preference_profiles" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "name" text NOT NULL,
  "slug" varchar(256) NOT NULL,
  "description" text,
  "settings" jsonb DEFAULT '{"includeTerms":[],"excludeTerms":[]}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp
);

ALTER TABLE "source_preferences"
ADD COLUMN IF NOT EXISTS "profile_id" varchar(191);

DROP INDEX IF EXISTS "source_preferences_user_target_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "source_preferences_user_global_target_idx" ON "source_preferences" ("user_id", "target")
WHERE
  "profile_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "source_preferences_user_profile_target_idx" ON "source_preferences" ("user_id", "profile_id", "target")
WHERE
  "profile_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "source_preference_profiles_user_slug_idx" ON "source_preference_profiles" ("user_id", "slug");

CREATE INDEX IF NOT EXISTS "source_preference_profiles_user_active_idx" ON "source_preference_profiles" ("user_id", "is_active");

ALTER TABLE "source_preference_profiles" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'source_preference_profiles'
      AND policyname = 'users_manage_own_source_preference_profiles'
  ) THEN
    CREATE POLICY "users_manage_own_source_preference_profiles"
      ON "source_preference_profiles"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;
