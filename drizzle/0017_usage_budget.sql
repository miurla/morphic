-- Durable grant authority and best-effort usage analytics. Runtime balances
-- remain in Redis; these tables do not determine whether a request is allowed.
CREATE TABLE IF NOT EXISTS "usage_grants" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "idempotency_key" varchar(256) NOT NULL,
  "kind" varchar(256) NOT NULL,
  "amount" integer NOT NULL,
  "granted_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_grants_user_idempotency_idx" ON "usage_grants" USING btree ("user_id", "idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_grants_user_expires_idx" ON "usage_grants" USING btree ("user_id", "expires_at");--> statement-breakpoint
ALTER TABLE "usage_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "event_type" varchar(256) NOT NULL,
  "amount" integer NOT NULL,
  "mode" varchar(256),
  "attempt_id" varchar(191) NOT NULL,
  "message_id" varchar(191),
  "remaining" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_events_user_type_attempt_idx" ON "usage_events" USING btree ("user_id", "event_type", "attempt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id", "created_at");--> statement-breakpoint
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "additional_usage_interest" (
  "user_id" varchar(255) PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "first_clicked_at" timestamp DEFAULT now() NOT NULL,
  "last_clicked_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "additional_usage_interest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_grants' AND policyname = 'users_read_own_usage_grants'
  ) THEN
    CREATE POLICY "users_read_own_usage_grants" ON "usage_grants"
      AS PERMISSIVE FOR SELECT TO public
      USING (user_id = (select current_setting('app.current_user_id', true)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_grants' AND policyname = 'users_insert_own_usage_grants'
  ) THEN
    CREATE POLICY "users_insert_own_usage_grants" ON "usage_grants"
      AS PERMISSIVE FOR INSERT TO public
      WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_events' AND policyname = 'users_read_own_usage_events'
  ) THEN
    CREATE POLICY "users_read_own_usage_events" ON "usage_events"
      AS PERMISSIVE FOR SELECT TO public
      USING (user_id = (select current_setting('app.current_user_id', true)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_events' AND policyname = 'users_insert_own_usage_events'
  ) THEN
    CREATE POLICY "users_insert_own_usage_events" ON "usage_events"
      AS PERMISSIVE FOR INSERT TO public
      WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'additional_usage_interest' AND policyname = 'users_write_own_additional_usage_interest'
  ) THEN
    CREATE POLICY "users_write_own_additional_usage_interest" ON "additional_usage_interest"
      AS PERMISSIVE FOR ALL TO public
      USING (user_id = (select current_setting('app.current_user_id', true)))
      WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));
  END IF;
END $$;--> statement-breakpoint

-- The production restricted connection uses app_user. Keep local databases
-- without that role migratable while granting the minimum runtime privileges
-- when it is present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT ON TABLE "usage_grants" TO app_user;
    GRANT SELECT, INSERT ON TABLE "usage_events" TO app_user;
    GRANT SELECT, INSERT, UPDATE ON TABLE "additional_usage_interest" TO app_user;
  END IF;
END $$;
