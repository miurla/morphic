CREATE POLICY "users_manage_own_chats" ON "chats" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.current_user_id', true)) WITH CHECK (user_id = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "users_manage_chat_messages" ON "messages" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
        SELECT 1 FROM "chats"
        WHERE "chats".id = chat_id
        AND "chats".user_id = current_setting('app.current_user_id', true)
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM "chats"
        WHERE "chats".id = chat_id
        AND "chats".user_id = current_setting('app.current_user_id', true)
      ));--> statement-breakpoint
CREATE POLICY "users_manage_message_parts" ON "parts" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
        SELECT 1 FROM "messages"
        INNER JOIN "chats" ON "chats".id = "messages".chat_id
        WHERE "messages".id = message_id
        AND "chats".user_id = current_setting('app.current_user_id', true)
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM "messages"
        INNER JOIN "chats" ON "chats".id = "messages".chat_id
        WHERE "messages".id = message_id
        AND "chats".user_id = current_setting('app.current_user_id', true)
      ));