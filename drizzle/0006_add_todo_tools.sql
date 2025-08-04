-- Add todo tool columns
ALTER TABLE "parts" ADD COLUMN "tool_todoWrite_input" json;
ALTER TABLE "parts" ADD COLUMN "tool_todoWrite_output" json;
ALTER TABLE "parts" ADD COLUMN "tool_todoRead_input" json;
ALTER TABLE "parts" ADD COLUMN "tool_todoRead_output" json;