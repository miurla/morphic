-- Rename MCP columns to dynamic tool columns
ALTER TABLE "parts" RENAME COLUMN "tool_mcp_input" TO "tool_dynamic_input";
ALTER TABLE "parts" RENAME COLUMN "tool_mcp_output" TO "tool_dynamic_output";

-- Add new columns for dynamic tool metadata
ALTER TABLE "parts" ADD COLUMN "tool_dynamic_name" varchar(256);
ALTER TABLE "parts" ADD COLUMN "tool_dynamic_type" varchar(256);