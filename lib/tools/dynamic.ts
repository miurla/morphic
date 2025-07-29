import { dynamicTool } from 'ai'
import { z } from 'zod'

import type { MCPClient } from '@/lib/types/dynamic-tools'

/**
 * Creates a dynamic tool that can be used for runtime-defined tools
 * such as MCP tools or user-defined functions
 */
export function createDynamicTool(
  name: string,
  description: string,
  execute: (input: unknown) => Promise<unknown>
) {
  return dynamicTool({
    description,
    // Use a flexible schema that accepts any object
    inputSchema: z.object({}).passthrough(),
    execute: async input => {
      try {
        const result = await execute(input)
        return result
      } catch (error) {
        console.error(`Error executing dynamic tool ${name}:`, error)
        throw error
      }
    }
  })
}

/**
 * Example: Create an MCP tool wrapper
 */
export function createMCPTool(
  toolName: string,
  description: string,
  mcpClient: MCPClient
) {
  return createDynamicTool(`mcp__${toolName}`, description, async input => {
    // Execute the MCP tool
    return await mcpClient.callTool(toolName, input)
  })
}

/**
 * Example: Create a custom user-defined tool
 */
export function createCustomTool(
  name: string,
  description: string,
  handler: (params: unknown) => Promise<unknown>
) {
  return createDynamicTool(`dynamic__${name}`, description, handler)
}
