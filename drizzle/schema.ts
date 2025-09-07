import { pgTable, index, pgPolicy, varchar, timestamp, text, foreignKey, jsonb, check, integer, json } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const chats = pgTable("chats", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	visibility: varchar({ length: 256 }).default('private').notNull(),
}, (table) => [
	index("chats_created_at_idx").using("btree", table.createdAt.desc().nullsLast().op("timestamp_ops")),
	index("chats_id_user_id_idx").using("btree", table.id.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	index("chats_user_id_created_at_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.desc().nullsLast().op("text_ops")),
	index("chats_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("public_chats_readable", { as: "permissive", for: "select", to: ["public"], using: sql`((visibility)::text = 'public'::text)` }),
	pgPolicy("users_manage_own_chats", { as: "permissive", for: "all", to: ["public"] }),
]);

export const messages = pgTable("messages", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	chatId: varchar("chat_id", { length: 191 }).notNull(),
	role: varchar({ length: 256 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	metadata: jsonb(),
}, (table) => [
	index("messages_chat_id_created_at_idx").using("btree", table.chatId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	index("messages_chat_id_idx").using("btree", table.chatId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "messages_chat_id_chats_id_fk"
		}).onDelete("cascade"),
	pgPolicy("public_chat_messages_readable", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM chats
  WHERE (((chats.id)::text = (messages.chat_id)::text) AND ((chats.visibility)::text = 'public'::text))))` }),
	pgPolicy("users_manage_chat_messages", { as: "permissive", for: "all", to: ["public"] }),
]);

export const parts = pgTable("parts", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	messageId: varchar("message_id", { length: 191 }).notNull(),
	order: integer().notNull(),
	type: varchar({ length: 256 }).notNull(),
	textText: text("text_text"),
	reasoningText: text("reasoning_text"),
	fileMediaType: varchar("file_media_type", { length: 256 }),
	fileFilename: varchar("file_filename", { length: 1024 }),
	fileUrl: text("file_url"),
	sourceUrlSourceId: varchar("source_url_source_id", { length: 256 }),
	sourceUrlUrl: text("source_url_url"),
	sourceUrlTitle: text("source_url_title"),
	sourceDocumentSourceId: varchar("source_document_source_id", { length: 256 }),
	sourceDocumentMediaType: varchar("source_document_media_type", { length: 256 }),
	sourceDocumentTitle: text("source_document_title"),
	sourceDocumentFilename: varchar("source_document_filename", { length: 1024 }),
	sourceDocumentUrl: text("source_document_url"),
	sourceDocumentSnippet: text("source_document_snippet"),
	toolToolCallId: varchar("tool_tool_call_id", { length: 256 }),
	toolState: varchar("tool_state", { length: 256 }),
	toolErrorText: text("tool_error_text"),
	toolSearchInput: json("tool_search_input"),
	toolSearchOutput: json("tool_search_output"),
	toolFetchInput: json("tool_fetch_input"),
	toolFetchOutput: json("tool_fetch_output"),
	toolQuestionInput: json("tool_question_input"),
	toolQuestionOutput: json("tool_question_output"),
	toolTodoWriteInput: json("tool_todoWrite_input"),
	toolTodoWriteOutput: json("tool_todoWrite_output"),
	toolTodoReadInput: json("tool_todoRead_input"),
	toolTodoReadOutput: json("tool_todoRead_output"),
	toolDynamicInput: json("tool_dynamic_input"),
	toolDynamicOutput: json("tool_dynamic_output"),
	toolDynamicName: varchar("tool_dynamic_name", { length: 256 }),
	toolDynamicType: varchar("tool_dynamic_type", { length: 256 }),
	dataPrefix: varchar("data_prefix", { length: 256 }),
	dataContent: json("data_content"),
	dataId: varchar("data_id", { length: 256 }),
	providerMetadata: json("provider_metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("parts_message_id_idx").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	index("parts_message_id_order_idx").using("btree", table.messageId.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "parts_message_id_messages_id_fk"
		}).onDelete("cascade"),
	pgPolicy("public_chat_parts_readable", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM (messages
     JOIN chats ON (((chats.id)::text = (messages.chat_id)::text)))
  WHERE (((messages.id)::text = (parts.message_id)::text) AND ((chats.visibility)::text = 'public'::text))))` }),
	pgPolicy("users_manage_message_parts", { as: "permissive", for: "all", to: ["public"] }),
	check("text_text_required", sql`((type)::text <> 'text'::text) OR (text_text IS NOT NULL)`),
	check("reasoning_text_required", sql`((type)::text <> 'reasoning'::text) OR (reasoning_text IS NOT NULL)`),
	check("file_fields_required", sql`((type)::text <> 'file'::text) OR ((file_media_type IS NOT NULL) AND (file_filename IS NOT NULL) AND (file_url IS NOT NULL))`),
	check("tool_state_valid", sql`(tool_state IS NULL) OR ((tool_state)::text = ANY ((ARRAY['input-streaming'::character varying, 'input-available'::character varying, 'output-available'::character varying, 'output-error'::character varying])::text[]))`),
	check("tool_fields_required", sql`((type)::text !~~ 'tool-%'::text) OR ((tool_tool_call_id IS NOT NULL) AND (tool_state IS NOT NULL))`),
]);

export const feedback = pgTable("feedback", {
	id: varchar({ length: 191 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }),
	sentiment: varchar({ length: 256 }).notNull(),
	message: text().notNull(),
	pageUrl: text("page_url").notNull(),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feedback_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("feedback_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("feedback_select_policy", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("feedback_insert_policy", { as: "permissive", for: "insert", to: ["public"] }),
]);
