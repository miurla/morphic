import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

export const chats = pgTable(
  'chats',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    title: text().notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    visibility: varchar({ length: 256 }).default('private').notNull()
  },
  table => [
    index('chats_created_at_idx').using(
      'btree',
      table.createdAt.desc().nullsLast().op('timestamp_ops')
    ),
    index('chats_id_user_id_idx').using(
      'btree',
      table.id.asc().nullsLast().op('text_ops'),
      table.userId.asc().nullsLast().op('text_ops')
    ),
    index('chats_user_id_created_at_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('timestamp_ops'),
      table.createdAt.desc().nullsLast().op('text_ops')
    ),
    index('chats_user_id_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops')
    ),
    pgPolicy('public_chats_readable', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`((visibility)::text = 'public'::text)`
    }),
    pgPolicy('users_manage_own_chats', {
      as: 'permissive',
      for: 'all',
      to: ['public']
    })
  ]
)

export const messages = pgTable(
  'messages',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    chatId: varchar('chat_id', { length: 191 }).notNull(),
    role: varchar({ length: 256 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
    metadata: jsonb()
  },
  table => [
    index('messages_chat_id_created_at_idx').using(
      'btree',
      table.chatId.asc().nullsLast().op('text_ops'),
      table.createdAt.asc().nullsLast().op('text_ops')
    ),
    index('messages_chat_id_idx').using(
      'btree',
      table.chatId.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chats.id],
      name: 'messages_chat_id_chats_id_fk'
    }).onDelete('cascade'),
    pgPolicy('public_chat_messages_readable', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`(EXISTS ( SELECT 1
   FROM chats
  WHERE (((chats.id)::text = (messages.chat_id)::text) AND ((chats.visibility)::text = 'public'::text))))`
    }),
    pgPolicy('users_manage_chat_messages', {
      as: 'permissive',
      for: 'all',
      to: ['public']
    })
  ]
)

export const parts = pgTable(
  'parts',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    messageId: varchar('message_id', { length: 191 }).notNull(),
    order: integer().notNull(),
    type: varchar({ length: 256 }).notNull(),
    textText: text('text_text'),
    reasoningText: text('reasoning_text'),
    fileMediaType: varchar('file_media_type', { length: 256 }),
    fileFilename: varchar('file_filename', { length: 1024 }),
    fileUrl: text('file_url'),
    sourceUrlSourceId: varchar('source_url_source_id', { length: 256 }),
    sourceUrlUrl: text('source_url_url'),
    sourceUrlTitle: text('source_url_title'),
    sourceDocumentSourceId: varchar('source_document_source_id', {
      length: 256
    }),
    sourceDocumentMediaType: varchar('source_document_media_type', {
      length: 256
    }),
    sourceDocumentTitle: text('source_document_title'),
    sourceDocumentFilename: varchar('source_document_filename', {
      length: 1024
    }),
    sourceDocumentUrl: text('source_document_url'),
    sourceDocumentSnippet: text('source_document_snippet'),
    toolToolCallId: varchar('tool_tool_call_id', { length: 256 }),
    toolState: varchar('tool_state', { length: 256 }),
    toolErrorText: text('tool_error_text'),
    toolSearchInput: json('tool_search_input'),
    toolSearchOutput: json('tool_search_output'),
    toolFeedSearchInput: json('tool_feedSearch_input'),
    toolFeedSearchOutput: json('tool_feedSearch_output'),
    toolFetchInput: json('tool_fetch_input'),
    toolFetchOutput: json('tool_fetch_output'),
    toolQuestionInput: json('tool_question_input'),
    toolQuestionOutput: json('tool_question_output'),
    toolTodoWriteInput: json('tool_todoWrite_input'),
    toolTodoWriteOutput: json('tool_todoWrite_output'),
    toolTodoReadInput: json('tool_todoRead_input'),
    toolTodoReadOutput: json('tool_todoRead_output'),
    toolDynamicInput: json('tool_dynamic_input'),
    toolDynamicOutput: json('tool_dynamic_output'),
    toolDynamicName: varchar('tool_dynamic_name', { length: 256 }),
    toolDynamicType: varchar('tool_dynamic_type', { length: 256 }),
    dataPrefix: varchar('data_prefix', { length: 256 }),
    dataContent: json('data_content'),
    dataId: varchar('data_id', { length: 256 }),
    providerMetadata: json('provider_metadata'),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull()
  },
  table => [
    index('parts_message_id_idx').using(
      'btree',
      table.messageId.asc().nullsLast().op('text_ops')
    ),
    index('parts_message_id_order_idx').using(
      'btree',
      table.messageId.asc().nullsLast().op('int4_ops'),
      table.order.asc().nullsLast().op('int4_ops')
    ),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [messages.id],
      name: 'parts_message_id_messages_id_fk'
    }).onDelete('cascade'),
    pgPolicy('public_chat_parts_readable', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`(EXISTS ( SELECT 1
   FROM (messages
     JOIN chats ON (((chats.id)::text = (messages.chat_id)::text)))
  WHERE (((messages.id)::text = (parts.message_id)::text) AND ((chats.visibility)::text = 'public'::text))))`
    }),
    pgPolicy('users_manage_message_parts', {
      as: 'permissive',
      for: 'all',
      to: ['public']
    }),
    check(
      'text_text_required',
      sql`((type)::text <> 'text'::text) OR (text_text IS NOT NULL)`
    ),
    check(
      'reasoning_text_required',
      sql`((type)::text <> 'reasoning'::text) OR (reasoning_text IS NOT NULL)`
    ),
    check(
      'file_fields_required',
      sql`((type)::text <> 'file'::text) OR ((file_media_type IS NOT NULL) AND (file_filename IS NOT NULL) AND (file_url IS NOT NULL))`
    ),
    check(
      'tool_state_valid',
      sql`(tool_state IS NULL) OR ((tool_state)::text = ANY ((ARRAY['input-streaming'::character varying, 'input-available'::character varying, 'output-available'::character varying, 'output-error'::character varying])::text[]))`
    ),
    check(
      'tool_fields_required',
      sql`((type)::text !~~ 'tool-%'::text) OR ((tool_tool_call_id IS NOT NULL) AND (tool_state IS NOT NULL))`
    )
  ]
)

export const sourceEvents = pgTable(
  'source_events',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    userId: varchar('user_id', { length: 255 }),
    chatId: varchar('chat_id', { length: 191 }),
    sourceId: varchar('source_id', { length: 256 }),
    eventType: varchar('event_type', { length: 256 }).notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceDomain: text('source_domain').notNull(),
    pageUrl: text('page_url'),
    metadata: jsonb(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull()
  },
  table => [
    index('source_events_user_id_created_at_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.createdAt.desc().nullsLast().op('timestamp_ops')
    ),
    index('source_events_chat_id_idx').using(
      'btree',
      table.chatId.asc().nullsLast().op('text_ops')
    ),
    index('source_events_source_domain_idx').using(
      'btree',
      table.sourceDomain.asc().nullsLast().op('text_ops')
    ),
    index('source_events_event_type_created_at_idx').using(
      'btree',
      table.eventType.asc().nullsLast().op('text_ops'),
      table.createdAt.desc().nullsLast().op('timestamp_ops')
    ),
    pgPolicy('anyone_can_insert_source_events', {
      as: 'permissive',
      for: 'insert',
      to: ['public']
    }),
    check(
      'source_events_event_type_valid',
      sql`((event_type)::text = ANY ((ARRAY['impression'::character varying, 'open_original'::character varying, 'open_reader'::character varying, 'save'::character varying, 'copy_link'::character varying, 'report'::character varying])::text[]))`
    )
  ]
)

export const readingItems = pgTable(
  'reading_items',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    sourceId: varchar('source_id', { length: 256 }),
    url: text().notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text().notNull(),
    author: text(),
    siteName: text('site_name'),
    domain: text(),
    publishedAt: timestamp('published_at', { mode: 'string' }),
    summary: text(),
    imageUrl: text('image_url'),
    faviconUrl: text('favicon_url'),
    status: varchar({ length: 256 }).default('unread').notNull(),
    savedFromChatId: varchar('saved_from_chat_id', { length: 191 }),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
  },
  table => [
    index('reading_items_user_id_created_at_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.createdAt.desc().nullsLast().op('timestamp_ops')
    ),
    index('reading_items_user_id_status_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.status.asc().nullsLast().op('text_ops')
    ),
    index('reading_items_domain_idx').using(
      'btree',
      table.domain.asc().nullsLast().op('text_ops')
    ),
    uniqueIndex('reading_items_user_canonical_url_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.canonicalUrl.asc().nullsLast().op('text_ops')
    ),
    pgPolicy('users_manage_own_reading_items', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id = current_setting('app.current_user_id', true)`
    }),
    check(
      'reading_items_status_valid',
      sql`((status)::text = ANY ((ARRAY['unread'::character varying, 'reading'::character varying, 'read'::character varying, 'archived'::character varying])::text[]))`
    )
  ]
)

export const feedback = pgTable(
  'feedback',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    userId: varchar('user_id', { length: 255 }),
    sentiment: varchar({ length: 256 }).notNull(),
    message: text().notNull(),
    pageUrl: text('page_url').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull()
  },
  table => [
    index('feedback_created_at_idx').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamp_ops')
    ),
    index('feedback_user_id_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops')
    ),
    pgPolicy('anyone_can_insert_feedback', {
      as: 'permissive',
      for: 'insert',
      to: ['public']
    }),
    pgPolicy('users_anonymize_own_feedback', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id IS NULL`
    })
  ]
)

export const sourcePreferenceProfiles = pgTable(
  'source_preference_profiles',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: text().notNull(),
    slug: varchar({ length: 256 }).notNull(),
    description: text(),
    settings: jsonb().default({ includeTerms: [], excludeTerms: [] }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
  },
  table => [
    uniqueIndex('source_preference_profiles_user_slug_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.slug.asc().nullsLast().op('text_ops')
    ),
    index('source_preference_profiles_user_active_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('bool_ops')
    ),
    pgPolicy('users_manage_own_source_preference_profiles', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id = current_setting('app.current_user_id', true)`
    })
  ]
)

export const sourcePreferences = pgTable(
  'source_preferences',
  {
    id: varchar({ length: 191 }).primaryKey().notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    profileId: varchar('profile_id', { length: 191 }),
    target: text().notNull(),
    targetType: varchar('target_type', { length: 256 }).notNull(),
    domain: text().notNull(),
    preference: varchar({ length: 256 }).notNull(),
    note: text(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
  },
  table => [
    uniqueIndex('source_preferences_user_global_target_idx')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('text_ops'),
        table.target.asc().nullsLast().op('text_ops')
      )
      .where(sql`profile_id IS NULL`),
    uniqueIndex('source_preferences_user_profile_target_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.profileId.asc().nullsLast().op('text_ops'),
      table.target.asc().nullsLast().op('text_ops')
    ),
    index('source_preferences_user_id_updated_at_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.updatedAt.desc().nullsLast().op('timestamp_ops')
    ),
    index('source_preferences_user_domain_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.domain.asc().nullsLast().op('text_ops')
    ),
    pgPolicy('users_manage_own_source_preferences', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id = current_setting('app.current_user_id', true)`
    }),
    check(
      'source_preferences_target_type_valid',
      sql`((target_type)::text = ANY ((ARRAY['domain'::character varying, 'url'::character varying])::text[]))`
    ),
    check(
      'source_preferences_preference_valid',
      sql`((preference)::text = ANY ((ARRAY['trust'::character varying, 'prefer'::character varying, 'mute'::character varying, 'block'::character varying])::text[]))`
    )
  ]
)
