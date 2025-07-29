-- Remove video search columns from parts table
ALTER TABLE "parts" DROP COLUMN IF EXISTS "tool_video_search_input";
ALTER TABLE "parts" DROP COLUMN IF EXISTS "tool_video_search_output";