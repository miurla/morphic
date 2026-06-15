CREATE TABLE IF NOT EXISTS "source_events" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255),
  "chat_id" varchar(191),
  "source_id" varchar(256),
  "event_type" varchar(256) NOT NULL,
  "source_url" text NOT NULL,
  "source_domain" text NOT NULL,
  "page_url" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "source_events_event_type_valid" CHECK (
    "event_type" IN (
      'impression',
      'open_original',
      'open_reader',
      'save',
      'copy_link',
      'report'
    )
  )
);

CREATE INDEX IF NOT EXISTS "source_events_user_id_created_at_idx" ON "source_events" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "source_events_chat_id_idx" ON "source_events" ("chat_id");

CREATE INDEX IF NOT EXISTS "source_events_source_domain_idx" ON "source_events" ("source_domain");

CREATE INDEX IF NOT EXISTS "source_events_event_type_created_at_idx" ON "source_events" ("event_type", "created_at" DESC);

ALTER TABLE "source_events" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'source_events' AND policyname = 'anyone_can_insert_source_events'
  ) THEN
    CREATE POLICY "anyone_can_insert_source_events" ON "source_events"
      AS PERMISSIVE
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;
