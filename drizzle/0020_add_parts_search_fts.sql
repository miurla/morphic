ALTER TABLE "parts" ADD COLUMN "search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(text_text, ''))) STORED;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "search_reasoning" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(reasoning_text, ''))) STORED;--> statement-breakpoint
CREATE INDEX "parts_search_idx" ON "parts" USING gin ("search");--> statement-breakpoint
CREATE INDEX "parts_search_reasoning_idx" ON "parts" USING gin ("search_reasoning");