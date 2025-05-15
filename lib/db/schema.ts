import { InferSelectModel } from 'drizzle-orm'
import {
  json,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow(),
    title: text('title').notNull(),
    userId: uuid('user_id').notNull(), // User ID from the authentication system
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

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 256 }).notNull(),
    parts: json('parts').notNull(), // Stores structured message content (e.g., Vercel AI SDK Message parts)
    attachments: json('attachments').notNull(),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => {
    return {
      enableRls: true
    }
  }
)

export type Message = InferSelectModel<typeof messages>
