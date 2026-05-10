CREATE TABLE "unipile_accounts" (
	"account_id" varchar(256) PRIMARY KEY NOT NULL,
	"email" varchar(256),
	"provider" varchar(50) DEFAULT 'LINKEDIN' NOT NULL,
	"name" varchar(256),
	"public_identifier" varchar(256),
	"linkedin_urn_id" varchar(256),
	"status" varchar(50) DEFAULT 'RUNNING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unipile_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "unipile_accounts_email_idx" ON "unipile_accounts" USING btree ("email");--> statement-breakpoint
CREATE POLICY "unipile_select" ON "unipile_accounts" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "unipile_insert" ON "unipile_accounts" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "unipile_update" ON "unipile_accounts" AS PERMISSIVE FOR UPDATE TO public USING (true);