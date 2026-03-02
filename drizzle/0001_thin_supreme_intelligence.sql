ALTER TABLE "messages" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "metadata" json;