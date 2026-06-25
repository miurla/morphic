import { relations } from 'drizzle-orm/relations'

import { chats, files, messages, notes, parts } from './schema'

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  }),
  parts: many(parts)
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
  notes: many(notes),
  files: many(files)
}))

export const partsRelations = relations(parts, ({ one }) => ({
  message: one(messages, {
    fields: [parts.messageId],
    references: [messages.id]
  })
}))

export const notesRelations = relations(notes, ({ one }) => ({
  chat: one(chats, {
    fields: [notes.chatId],
    references: [chats.id]
  })
}))

export const filesRelations = relations(files, ({ one }) => ({
  chat: one(chats, {
    fields: [files.chatId],
    references: [chats.id]
  })
}))
