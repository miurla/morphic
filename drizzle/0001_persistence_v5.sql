-- Drop existing tables if they exist (clean slate approach)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

-- Create new chats table with generateId
CREATE TABLE chats (
  id VARCHAR PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  title TEXT NOT NULL,
  user_id VARCHAR NOT NULL,
  visibility VARCHAR(256) DEFAULT 'private' NOT NULL CHECK (visibility IN ('public', 'private'))
);

-- Create new messages table (simplified)
CREATE TABLE messages (
  id VARCHAR PRIMARY KEY,
  chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(256) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for messages
CREATE INDEX messages_chat_id_idx ON messages(chat_id);
CREATE INDEX messages_chat_id_created_at_idx ON messages(chat_id, created_at);

-- Create parts table
CREATE TABLE parts (
  id VARCHAR PRIMARY KEY,
  message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  type VARCHAR(256) NOT NULL,
  
  -- Text parts
  text_text TEXT,
  
  -- Reasoning parts
  reasoning_text TEXT,
  
  -- File parts
  file_media_type VARCHAR(256),
  file_filename VARCHAR(1024),
  file_url TEXT,
  
  -- Source URL parts
  source_url_source_id VARCHAR(256),
  source_url_url TEXT,
  source_url_title TEXT,
  
  -- Source document parts
  source_document_source_id VARCHAR(256),
  source_document_media_type VARCHAR(256),
  source_document_title TEXT,
  source_document_filename VARCHAR(1024),
  source_document_url TEXT,
  source_document_snippet TEXT,
  
  -- Tool parts (generic)
  tool_tool_call_id VARCHAR(256),
  tool_state VARCHAR(256),
  tool_error_text TEXT,
  
  -- Tool-specific columns
  tool_search_input JSONB,
  tool_search_output JSONB,
  tool_retrieve_input JSONB,
  tool_retrieve_output JSONB,
  tool_question_input JSONB,
  tool_question_output JSONB,
  tool_video_search_input JSONB,
  tool_video_search_output JSONB,
  tool_mcp_input JSONB,
  tool_mcp_output JSONB,
  
  -- Data parts
  data_prefix VARCHAR(256),
  data_content JSONB,
  data_id VARCHAR(256),
  
  -- Provider metadata
  provider_metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for parts
CREATE INDEX parts_message_id_idx ON parts(message_id);
CREATE INDEX parts_message_id_order_idx ON parts(message_id, "order");

-- Add constraints
ALTER TABLE parts ADD CONSTRAINT text_text_required 
  CHECK (type != 'text' OR text_text IS NOT NULL);

ALTER TABLE parts ADD CONSTRAINT reasoning_text_required 
  CHECK (type != 'reasoning' OR reasoning_text IS NOT NULL);

ALTER TABLE parts ADD CONSTRAINT file_fields_required 
  CHECK (type != 'file' OR (file_media_type IS NOT NULL AND file_filename IS NOT NULL AND file_url IS NOT NULL));

ALTER TABLE parts ADD CONSTRAINT tool_state_valid 
  CHECK (tool_state IS NULL OR tool_state IN ('input-streaming', 'input-available', 'output-available', 'output-error'));

ALTER TABLE parts ADD CONSTRAINT tool_fields_required 
  CHECK (type NOT LIKE 'tool-%' OR (tool_tool_call_id IS NOT NULL AND tool_state IS NOT NULL));

-- Enable Row Level Security (if needed)
-- ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE parts ENABLE ROW LEVEL SECURITY;