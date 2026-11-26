ALTER TABLE "tutor_documents" ADD COLUMN "token_count" integer;
--> statement-breakpoint
ALTER TABLE "tutor_documents" ADD COLUMN "chunk_count" integer;
--> statement-breakpoint
CREATE TABLE "tutor_document_parses" (
  "document_id" text PRIMARY KEY CONSTRAINT "tutor_document_parses_document_id_tutor_documents_id_fk" REFERENCES "tutor_documents"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "content_hash" text NOT NULL,
  "parser_version" text NOT NULL,
  "parsed" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_document_parses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tutor_document_parses_owner" ON "tutor_document_parses" FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));
