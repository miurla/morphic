-- Drop updatedAt column from chats table
ALTER TABLE "chats" DROP COLUMN "updated_at";

-- Drop updatedAt column from messages table
ALTER TABLE "messages" DROP COLUMN "updated_at";

-- Add attachments column to messages table
ALTER TABLE "messages" ADD COLUMN "attachments" jsonb NOT NULL DEFAULT '{}'; 