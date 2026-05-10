CREATE TABLE "heartbeat_runs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"heartbeat_id" varchar(191) NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"view_token" varchar(50) NOT NULL,
	"notified_via" varchar(20) DEFAULT 'whatsapp' NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"chat_id" varchar(191),
	"chat_title" varchar(256) NOT NULL,
	"query" text NOT NULL,
	"frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"channel" varchar(20) DEFAULT 'whatsapp' NOT NULL,
	"whatsapp_number" varchar(50),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heartbeats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_heartbeat_id_heartbeats_id_fk" FOREIGN KEY ("heartbeat_id") REFERENCES "public"."heartbeats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heartbeat_runs_heartbeat_id_idx" ON "heartbeat_runs" USING btree ("heartbeat_id");--> statement-breakpoint
CREATE INDEX "heartbeat_runs_view_token_idx" ON "heartbeat_runs" USING btree ("view_token");--> statement-breakpoint
CREATE INDEX "heartbeats_user_id_idx" ON "heartbeats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "heartbeats_status_idx" ON "heartbeats" USING btree ("status");--> statement-breakpoint
CREATE POLICY "runs_select" ON "heartbeat_runs" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "runs_insert" ON "heartbeat_runs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "heartbeats_select" ON "heartbeats" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "heartbeats_insert" ON "heartbeats" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "heartbeats_update" ON "heartbeats" AS PERMISSIVE FOR UPDATE TO public USING (true);--> statement-breakpoint
CREATE POLICY "heartbeats_delete" ON "heartbeats" AS PERMISSIVE FOR DELETE TO public USING (true);