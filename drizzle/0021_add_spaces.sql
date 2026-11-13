CREATE TABLE "spaces" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"color" varchar(16) NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"style" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "space_id" varchar(191);--> statement-breakpoint
CREATE UNIQUE INDEX "spaces_user_id_color_idx" ON "spaces" USING btree ("user_id","color");--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chats_space_id_idx" ON "chats" USING btree ("space_id");--> statement-breakpoint
CREATE POLICY "users_manage_own_spaces" ON "spaces" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "spaces" TO app_user;
  END IF;
END $$;
