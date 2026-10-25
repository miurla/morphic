ALTER TABLE "parts" ADD COLUMN "search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', left(coalesce(text_text, ''), 100000))) STORED;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "search_reasoning" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', left(coalesce(reasoning_text, ''), 100000))) STORED;--> statement-breakpoint
CREATE INDEX "parts_search_idx" ON "parts" USING gin ("search");--> statement-breakpoint
CREATE INDEX "parts_search_reasoning_idx" ON "parts" USING gin ("search_reasoning");