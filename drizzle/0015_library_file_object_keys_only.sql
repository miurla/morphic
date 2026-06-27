ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "object_key" text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'files'
      AND column_name = 'url'
  ) THEN
    WITH normalized_file_urls AS (
      SELECT
        "id",
        split_part(regexp_replace("url", '^https?://[^/]+/', ''), '?', 1) AS "url_path"
      FROM "files"
      WHERE "object_key" IS NULL
        AND "url" IS NOT NULL
    )
    UPDATE "files"
    SET "object_key" = NULLIF(
      CASE
        WHEN normalized_file_urls."url_path" ~ '^[^/]+/[^/]+/chats/' THEN
          regexp_replace(
            normalized_file_urls."url_path",
            '^[^/]+/([^/]+/chats/.*)$',
            '\1'
          )
        ELSE normalized_file_urls."url_path"
      END,
      ''
    )
    FROM normalized_file_urls
    WHERE "files"."id" = normalized_file_urls."id";
  END IF;
END $$;

ALTER TABLE "files" ALTER COLUMN "object_key" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "files_object_key_idx" ON "files" USING btree ("object_key");

ALTER TABLE "files" DROP COLUMN IF EXISTS "url";
