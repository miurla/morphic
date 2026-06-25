import { relations } from 'drizzle-orm'

import { chats, libraryFiles, messages, notes, parts } from './schema'

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
  notes: many(notes),
  files: many(libraryFiles)
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  }),
  parts: many(parts)
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

export const libraryFilesRelations = relations(libraryFiles, ({ one }) => ({
  chat: one(chats, {
    fields: [libraryFiles.chatId],
    references: [chats.id]
  })
}))
