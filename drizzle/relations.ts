import { relations } from 'drizzle-orm/relations'
import { chats, messages, parts } from './schema'

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  }),
  parts: many(parts)
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages)
}))

export const partsRelations = relations(parts, ({ one }) => ({
  message: one(messages, {
    fields: [parts.messageId],
    references: [messages.id]
  })
}))
