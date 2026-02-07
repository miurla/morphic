CREATE POLICY "public_chats_readable" ON "chats" AS PERMISSIVE FOR SELECT TO public USING (visibility = 'public');--> statement-breakpoint
CREATE POLICY "public_chat_messages_readable" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
        SELECT 1 FROM "chats"
        WHERE "chats".id = chat_id
        AND "chats".visibility = 'public'
      ));--> statement-breakpoint
CREATE POLICY "public_chat_parts_readable" ON "parts" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
        SELECT 1 FROM "messages"
        INNER JOIN "chats" ON "chats".id = "messages".chat_id
        WHERE "messages".id = message_id
        AND "chats".visibility = 'public'
      ));