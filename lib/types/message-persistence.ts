import { z } from 'zod'

import type { UIMessage } from '@/lib/types/ai'

// Metadata schema
export const metadataSchema = z.object({})
export type Metadata = z.infer<typeof metadataSchema>

// Data part definition (extensible)
export const dataPartSchema = z.object({}).passthrough()
export type DataPart = z.infer<typeof dataPartSchema>

// Provider metadata
export type ProviderMetadata = Record<string, any>

// DB type definitions (mirrors the `parts` table schema)
export type DBMessagePart = {
  id?: string
  messageId: string
  order: number
  type: string
  text_text?: string | null
  reasoning_text?: string | null
  file_mediaType?: string | null
  file_filename?: string | null
  file_url?: string | null
  source_url_sourceId?: string | null
  source_url_url?: string | null
  source_url_title?: string | null
  source_document_sourceId?: string | null
  source_document_mediaType?: string | null
  source_document_title?: string | null
  source_document_filename?: string | null
  source_document_url?: string | null
  source_document_snippet?: string | null
  tool_toolCallId?: string | null
  tool_state?: string | null
  tool_errorText?: string | null
  tool_search_input?: any
  tool_search_output?: any
  tool_fetch_input?: any
  tool_fetch_output?: any
  tool_question_input?: any
  tool_question_output?: any
  tool_todoWrite_input?: any
  tool_todoWrite_output?: any
  tool_todoRead_input?: any
  tool_todoRead_output?: any
  tool_dynamic_input?: any
  tool_dynamic_output?: any
  tool_dynamic_name?: string | null
  tool_dynamic_type?: string | null
  data_prefix?: string | null
  data_content?: any
  data_id?: string | null
  providerMetadata?: Record<string, any> | null
  createdAt?: Date
}

export type DBMessagePartSelect = Required<DBMessagePart> & {
  id: string
  createdAt: Date
}

// Tool states
export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

// Dynamic tool type definitions (includes MCP and other runtime tools)
export type DynamicToolInput = {
  toolName: string
  params: unknown
}

export type DynamicToolOutput = unknown

// Dynamic tool type for storage
export type DynamicToolType = 'mcp' | 'dynamic' | 'custom'

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
  createdAt: Date | string
}

// Extended UIMessage type (persistence support)
export type PersistableUIMessage = UIMessage & {
  id: string
  chatId?: string
}
