CREATE TABLE "user_memories" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"confidence" integer DEFAULT 80 NOT NULL,
	"source_conversation_id" varchar(191),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_memory_edits" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"instruction" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memory_edits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "user_memories_user_id_idx" ON "user_memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_user_category_idx" ON "user_memories" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "user_memory_edits_user_id_idx" ON "user_memory_edits" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "memories_select" ON "user_memories" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "memories_insert" ON "user_memories" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "memories_update" ON "user_memories" AS PERMISSIVE FOR UPDATE TO public USING (true);--> statement-breakpoint
CREATE POLICY "memories_delete" ON "user_memories" AS PERMISSIVE FOR DELETE TO public USING (true);--> statement-breakpoint
CREATE POLICY "edits_select" ON "user_memory_edits" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "edits_insert" ON "user_memory_edits" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);