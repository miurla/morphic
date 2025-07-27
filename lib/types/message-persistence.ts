import { z } from 'zod'

import type { parts } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

// Metadata schema
export const metadataSchema = z.object({})
export type Metadata = z.infer<typeof metadataSchema>

// Data part definition (extensible)
export const dataPartSchema = z.object({}).passthrough()
export type DataPart = z.infer<typeof dataPartSchema>

// Provider metadata
export type ProviderMetadata = Record<string, any>

// DB type definitions
export type DBMessagePart = typeof parts.$inferInsert
export type DBMessagePartSelect = typeof parts.$inferSelect

// Tool states
export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

// MCP tool type definitions
export type MCPToolInput = {
  toolName: string
  params: unknown
}

export type MCPToolOutput = unknown

// Common MCP tool type definition examples
export type MCPGitHubInput = {
  toolName: 'mcp__github__create_issue'
  params: {
    owner: string
    repo: string
    title: string
    body?: string
  }
}

// DB message type
export type DBMessage = {
  id: string
  chatId: string
  role: string
  createdAt: string
}

// Extended UIMessage type (persistence support)
export type PersistableUIMessage = UIMessage & {
  id: string
  chatId?: string
}
