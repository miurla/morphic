CREATE TABLE IF NOT EXISTS "notes" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "chat_id" varchar(191),
  "source_message_id" varchar(191),
  "title" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notes_chat_id_chats_id_fk"
    FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "notes_user_id_idx" ON "notes" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "notes_user_id_updated_at_idx" ON "notes" USING btree ("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "notes_chat_id_idx" ON "notes" USING btree ("chat_id");
CREATE INDEX IF NOT EXISTS "notes_source_message_id_idx" ON "notes" USING btree ("source_message_id");

ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notes' AND policyname = 'users_manage_own_notes'
  ) THEN
    CREATE POLICY "users_manage_own_notes" ON "notes"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;
