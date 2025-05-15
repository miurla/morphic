-- Enable RLS on tables
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;

-- Create policies for chats table
CREATE POLICY "Users can view their own chats" ON "chats"
FOR SELECT
TO authenticated
USING ((auth.uid())::uuid = "user_id");

CREATE POLICY "Users can view public chats" ON "chats"
FOR SELECT
TO authenticated, anon
USING ("visibility" = 'public');

CREATE POLICY "Users can insert their own chats" ON "chats"
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid())::uuid = "user_id");

CREATE POLICY "Users can update their own chats" ON "chats"
FOR UPDATE
TO authenticated
USING ((auth.uid())::uuid = "user_id")
WITH CHECK ((auth.uid())::uuid = "user_id");

CREATE POLICY "Users can delete their own chats" ON "chats"
FOR DELETE
TO authenticated
USING ((auth.uid())::uuid = "user_id");

-- Create policies for messages table
CREATE POLICY "Users can view messages from their own chats" ON "messages"
FOR SELECT
TO authenticated
USING (
  "chat_id" IN (
    SELECT "id" FROM "chats"
    WHERE (auth.uid())::uuid = "user_id"
  )
);

CREATE POLICY "Users can view messages from public chats" ON "messages"
FOR SELECT
TO authenticated, anon
USING (
  "chat_id" IN (
    SELECT "id" FROM "chats"
    WHERE "visibility" = 'public'
  )
);

CREATE POLICY "Users can insert messages to their own chats" ON "messages"
FOR INSERT
TO authenticated
WITH CHECK (
  "chat_id" IN (
    SELECT "id" FROM "chats"
    WHERE (auth.uid())::uuid = "user_id"
  )
);

CREATE POLICY "Users can update messages in their own chats" ON "messages"
FOR UPDATE
TO authenticated
USING (
  "chat_id" IN (
    SELECT "id" FROM "chats"
    WHERE (auth.uid())::uuid = "user_id"
  )
)
WITH CHECK (
  "chat_id" IN (
    SELECT "id" FROM "chats"
    WHERE (auth.uid())::uuid = "user_id"
  )
);

CREATE POLICY "Users can delete messages from their own chats" ON "messages"
FOR DELETE
TO authenticated
USING (
  "chat_id" IN (
    SELECT "id" FROM "chats"
    WHERE (auth.uid())::uuid = "user_id"
  )
); 