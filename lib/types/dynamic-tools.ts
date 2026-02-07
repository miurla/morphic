/**
 * Type definitions for dynamic tools
 */

// MCP Client interface
export interface MCPClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  callTool(toolName: string, input: unknown): Promise<unknown>
  sendRequest(request: object): Promise<object>
}

// Dynamic tool configuration
export interface DynamicToolConfig {
  name: string
  description: string
  handler?: (params: unknown) => Promise<unknown>
  mcpClient?: MCPClient
}

// Dynamic tool part types matching AI SDK v5
export type DynamicToolPart =
  | DynamicToolPartInputStreaming
  | DynamicToolPartInputAvailable
  | DynamicToolPartOutputAvailable
  | DynamicToolPartOutputError

interface DynamicToolPartBase {
  type: 'dynamic-tool'
  toolCallId: string
  toolName: string
}

export interface DynamicToolPartInputStreaming extends DynamicToolPartBase {
  state: 'input-streaming'
  input: unknown
}

export interface DynamicToolPartInputAvailable extends DynamicToolPartBase {
  state: 'input-available'
  input: unknown
}

export interface DynamicToolPartOutputAvailable extends DynamicToolPartBase {
  state: 'output-available'
  input: unknown
  output: unknown
}

export interface DynamicToolPartOutputError extends DynamicToolPartBase {
  state: 'output-error'
  input: unknown
  errorText: string
}

// Type guards
export function isDynamicToolPart(part: unknown): part is DynamicToolPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'dynamic-tool'
  )
}

export function isToolCallPart(
  part: unknown
): part is { type: 'tool-call'; toolCallId: string; toolName: string } {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'tool-call'
  )
}

export function isToolTypePart(
  part: unknown
): part is { type: string; toolCallId: string } {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    'toolCallId' in part &&
    typeof part.type === 'string' &&
    part.type.startsWith('tool-')
  )
}
