import { relations } from 'drizzle-orm'

import { chats, messages, parts, projects } from './schema'

export const projectsRelations = relations(projects, ({ many }) => ({
  chats: many(chats)
}))

export const chatsRelations = relations(chats, ({ one, many }) => ({
  messages: many(messages),
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id]
  })
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
