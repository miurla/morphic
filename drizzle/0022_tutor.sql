CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "tutor_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"question_id" text NOT NULL,
	"answer" text NOT NULL,
	"assessment" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tutor_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"objectives" jsonb NOT NULL,
	"knowledge_points" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"content" jsonb,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_chapters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tutor_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"parent_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"parent_text" text NOT NULL,
	"retrieval_text" text NOT NULL,
	"lexical_text" text NOT NULL,
	"heading" text NOT NULL,
	"regions" jsonb NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tutor_course_documents" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"document_id" text NOT NULL,
	CONSTRAINT "tutor_course_documents_course_id_document_id_pk" PRIMARY KEY("course_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "tutor_course_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tutor_courses" (
	"planning_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"level" text NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"processing_progress" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tutor_documents" (
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"object_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"index_key" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"page_count" integer,
	"error" text,
	"embedding_model" text,
	"parse_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tutor_attempts" ADD CONSTRAINT "tutor_attempts_chapter_id_tutor_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."tutor_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_chapters" ADD CONSTRAINT "tutor_chapters_course_id_tutor_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."tutor_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_chunks" ADD CONSTRAINT "tutor_chunks_document_id_tutor_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tutor_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_course_documents" ADD CONSTRAINT "tutor_course_documents_course_id_tutor_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."tutor_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_course_documents" ADD CONSTRAINT "tutor_course_documents_document_id_tutor_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tutor_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_attempts_chapter_idx" ON "tutor_attempts" USING btree ("user_id","chapter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_chapters_position_idx" ON "tutor_chapters" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "tutor_chunks_document_idx" ON "tutor_chunks" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX "tutor_chunks_lexical_idx" ON "tutor_chunks" USING gin (to_tsvector('simple', "lexical_text"));--> statement-breakpoint
CREATE INDEX "tutor_courses_owner_idx" ON "tutor_courses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tutor_documents_owner_idx" ON "tutor_documents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_documents_content_idx" ON "tutor_documents" USING btree ("user_id","content_hash","index_key");--> statement-breakpoint
CREATE POLICY "tutor_attempts_owner" ON "tutor_attempts" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "tutor_chapters_owner" ON "tutor_chapters" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "tutor_chunks_owner" ON "tutor_chunks" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "tutor_course_documents_owner" ON "tutor_course_documents" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "tutor_courses_owner" ON "tutor_courses" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "tutor_documents_owner" ON "tutor_documents" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tutor_documents, tutor_courses, tutor_course_documents, tutor_chunks, tutor_chapters, tutor_attempts TO app_user;
  END IF;
END $$;
