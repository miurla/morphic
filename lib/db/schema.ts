import { createId } from '@paralleldrive/cuid2'
import { InferSelectModel, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  varchar} from 'drizzle-orm/pg-core'

// ID generation function
export const generateId = () => createId()

// Chats table
export const chats = pgTable(
  'chats',
  {
    id: varchar('id').primaryKey().$defaultFn(() => generateId()),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
    title: text('title').notNull(),
    userId: varchar('user_id').notNull(),
    visibility: varchar('visibility', {
      length: 256,
      enum: ['public', 'private']
    })
      .notNull()
      .default('private')
  },
  table => {
    return {
      enableRls: true
    }
  }
)

export type Chat = InferSelectModel<typeof chats>

// Messages table (simplified)
export const messages = pgTable(
  'messages',
  {
    id: varchar('id').primaryKey().$defaultFn(() => generateId()),
    chatId: varchar('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 256 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => ({
    chatIdIdx: index('messages_chat_id_idx').on(table.chatId),
    chatIdCreatedAtIdx: index('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),
    enableRls: true
  })
)

export type Message = InferSelectModel<typeof messages>

// Parts table
export const parts = pgTable(
  'parts',
  {
    id: varchar('id').primaryKey().$defaultFn(() => generateId()),
    messageId: varchar('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    type: varchar('type', { length: 256 }).notNull(),
    
    // Text parts
    text_text: text('text_text'),
    
    // Reasoning parts
    reasoning_text: text('reasoning_text'),
    
    // File parts
    file_mediaType: varchar('file_media_type', { length: 256 }),
    file_filename: varchar('file_filename', { length: 1024 }),
    file_url: text('file_url'),
    
    // Source URL parts
    source_url_sourceId: varchar('source_url_source_id', { length: 256 }),
    source_url_url: text('source_url_url'),
    source_url_title: text('source_url_title'),
    
    // Source document parts
    source_document_sourceId: varchar('source_document_source_id', { length: 256 }),
    source_document_mediaType: varchar('source_document_media_type', { length: 256 }),
    source_document_title: text('source_document_title'),
    source_document_filename: varchar('source_document_filename', { length: 1024 }),
    source_document_url: text('source_document_url'),
    source_document_snippet: text('source_document_snippet'),
    
    // Tool parts (generic)
    tool_toolCallId: varchar('tool_tool_call_id', { length: 256 }),
    tool_state: varchar('tool_state', { length: 256 }),
    tool_errorText: text('tool_error_text'),
    
    // Tool-specific columns (all Morphic tools)
    tool_search_input: json('tool_search_input').$type<any>(),
    tool_search_output: json('tool_search_output').$type<any>(),
    tool_retrieve_input: json('tool_retrieve_input').$type<any>(),
    tool_retrieve_output: json('tool_retrieve_output').$type<any>(),
    tool_question_input: json('tool_question_input').$type<any>(),
    tool_question_output: json('tool_question_output').$type<any>(),
    tool_videoSearch_input: json('tool_video_search_input').$type<any>(),
    tool_videoSearch_output: json('tool_video_search_output').$type<any>(),
    tool_mcp_input: json('tool_mcp_input').$type<any>(),
    tool_mcp_output: json('tool_mcp_output').$type<any>(),
    
    // Data parts (generic support)
    data_prefix: varchar('data_prefix', { length: 256 }),
    data_content: json('data_content').$type<any>(),
    data_id: varchar('data_id', { length: 256 }),
    
    // Provider metadata
    providerMetadata: json('provider_metadata').$type<Record<string, any>>(),
    
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => ({
    // Indexes
    messageIdIdx: index('parts_message_id_idx').on(table.messageId),
    messageIdOrderIdx: index('parts_message_id_order_idx').on(table.messageId, table.order),
    enableRls: true,
    
    // Constraints
    textTextRequired: check('text_text_required', sql`(type != 'text' OR text_text IS NOT NULL)`),
    reasoningTextRequired: check('reasoning_text_required', sql`(type != 'reasoning' OR reasoning_text IS NOT NULL)`),
    fileFieldsRequired: check('file_fields_required', sql`(type != 'file' OR (file_media_type IS NOT NULL AND file_filename IS NOT NULL AND file_url IS NOT NULL))`),
    toolStateValid: check('tool_state_valid', sql`(tool_state IS NULL OR tool_state IN ('input-streaming', 'input-available', 'output-available', 'output-error'))`),
    toolFieldsRequired: check('tool_fields_required', sql`(type NOT LIKE 'tool-%' OR (tool_tool_call_id IS NOT NULL AND tool_state IS NOT NULL))`)
  })
)

export type Part = InferSelectModel<typeof parts>
export type NewPart = typeof parts.$inferInsert