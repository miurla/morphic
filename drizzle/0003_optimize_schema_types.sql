-- Optimize schema to match Vercel's implementation
-- Note: These changes affect column types only, not the actual data

-- Update varchar length constraints
ALTER TABLE chats ALTER COLUMN id TYPE varchar(191);
ALTER TABLE chats ALTER COLUMN user_id TYPE varchar(255);

ALTER TABLE messages ALTER COLUMN id TYPE varchar(191);
ALTER TABLE messages ALTER COLUMN chat_id TYPE varchar(191);

ALTER TABLE parts ALTER COLUMN id TYPE varchar(191);
ALTER TABLE parts ALTER COLUMN message_id TYPE varchar(191);

-- Note: Timestamp columns remain unchanged as PostgreSQL handles them appropriately
-- The mode change from 'string' to 'date' is handled at the application level