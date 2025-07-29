-- Rename MCP tool columns to dynamic tool columns
ALTER TABLE parts 
  RENAME COLUMN tool_mcp_input TO tool_dynamic_input;

ALTER TABLE parts 
  RENAME COLUMN tool_mcp_output TO tool_dynamic_output;

-- Add dynamic tool metadata columns for storing tool name and type
ALTER TABLE parts
  ADD COLUMN tool_dynamic_name VARCHAR(256),
  ADD COLUMN tool_dynamic_type VARCHAR(256);