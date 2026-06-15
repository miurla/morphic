CREATE TABLE IF NOT EXISTS "reading_items" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "source_id" varchar(256),
  "url" text NOT NULL,
  "canonical_url" text NOT NULL,
  "title" text NOT NULL,
  "author" text,
  "site_name" text,
  "domain" text,
  "published_at" timestamp,
  "summary" text,
  "image_url" text,
  "favicon_url" text,
  "status" varchar(256) DEFAULT 'unread' NOT NULL,
  "saved_from_chat_id" varchar(191),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  CONSTRAINT "reading_items_status_valid" CHECK (
    "status" IN ('unread', 'reading', 'read', 'archived')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "reading_items_user_canonical_url_idx" ON "reading_items" ("user_id", "canonical_url");

CREATE INDEX IF NOT EXISTS "reading_items_user_id_created_at_idx" ON "reading_items" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reading_items_user_id_status_idx" ON "reading_items" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "reading_items_domain_idx" ON "reading_items" ("domain");

ALTER TABLE "reading_items" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reading_items' AND policyname = 'users_manage_own_reading_items'
  ) THEN
    CREATE POLICY "users_manage_own_reading_items" ON "reading_items"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;
