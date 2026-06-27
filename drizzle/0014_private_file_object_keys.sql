ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "file_key" text;

ALTER TABLE "parts" DROP CONSTRAINT IF EXISTS "file_fields_required";
ALTER TABLE "parts" ADD CONSTRAINT "file_fields_required"
  CHECK (
    (type != 'file')
    OR (
      file_media_type IS NOT NULL
      AND file_filename IS NOT NULL
      AND (file_key IS NOT NULL OR file_url IS NOT NULL)
    )
  );
