CREATE TABLE IF NOT EXISTS "files" (
  "id" varchar(191) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "chat_id" varchar(191),
  "filename" text NOT NULL,
  "object_key" text NOT NULL,
  "media_type" varchar(256) NOT NULL,
  "size" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "files_chat_id_chats_id_fk"
    FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "files_user_id_idx" ON "files" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "files_user_id_updated_at_idx" ON "files" USING btree ("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "files_chat_id_idx" ON "files" USING btree ("chat_id");
CREATE INDEX IF NOT EXISTS "files_media_type_idx" ON "files" USING btree ("media_type");
CREATE INDEX IF NOT EXISTS "files_object_key_idx" ON "files" USING btree ("object_key");

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'files' AND policyname = 'users_manage_own_files'
  ) THEN
    CREATE POLICY "users_manage_own_files" ON "files"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;
