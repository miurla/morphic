import { createMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export type MelronMcpClient = Awaited<ReturnType<typeof createMCPClient>>

export async function createMelronMcpClient(): Promise<MelronMcpClient | null> {
  const baseUrl = process.env.MELRON_MCP_URL
  const token = process.env.MELRON_MCP_TOKEN
  if (!baseUrl || !token) return null

  const url = new URL(baseUrl)
  url.searchParams.set('token', token)

  try {
    return await createMCPClient({
      transport: new StreamableHTTPClientTransport(url)
    })
  } catch (error) {
    console.error('[melron-mcp] Failed to connect:', error)
    return null
  }
}
