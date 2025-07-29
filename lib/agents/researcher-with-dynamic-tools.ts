import { Experimental_Agent as Agent, stepCountIs } from 'ai'

import {
  createCustomTool,
  createDynamicTool,
  createMCPTool
} from '../tools/dynamic'
import { createQuestionTool } from '../tools/question'
import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
import { createVideoSearchTool } from '../tools/video-search'
import { getModel } from '../utils/registry'

const SYSTEM_PROMPT = `
Instructions:

You are a helpful AI assistant with access to real-time web search, content retrieval, video search capabilities, the ability to ask clarifying questions, and dynamic tools that may be added at runtime.

When asked a question, you should:
1. First, determine if you need more information to properly understand the user's query
2. **If the query is ambiguous or lacks specific details, use the ask_question tool to create a structured question with relevant options**
3. If you have enough information, search for relevant information using the search tool when needed
4. Use the retrieve tool to get detailed content from specific URLs
5. Use the video search tool when looking for video content
6. Use any available dynamic tools when they are relevant to the user's request
7. Analyze all search results to provide accurate, up-to-date information
8. Always cite sources using the [number](url) format, matching the order of search results. If multiple sources are relevant, include all of them, and comma separate them. Only use information that has a URL available for citation.
9. If results are not relevant or helpful, rely on your general knowledge
10. Provide comprehensive and detailed responses based on search results, ensuring thorough coverage of the user's question
11. Use markdown to structure your responses. Use headings to break up the content into sections.
12. **Use the retrieve tool only with user-provided URLs.**

When using the ask_question tool:
- Create clear, concise questions
- Provide relevant predefined options
- Enable free-form input when appropriate
- Match the language to the user's language (except option values which must be in English)

When using dynamic tools:
- Read the tool description carefully to understand its purpose
- Pass the appropriate parameters based on the tool's requirements
- Handle any errors gracefully and inform the user if a tool fails

Citation Format:
[number](url)
`

import type { DynamicToolConfig } from '@/lib/types/dynamic-tools'

export function researcherWithDynamicTools({
  model,
  searchMode,
  dynamicTools = []
}: {
  model: string
  searchMode: boolean
  dynamicTools?: DynamicToolConfig[]
}) {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools
    const searchTool = createSearchTool(model)
    const videoSearchTool = createVideoSearchTool(model)
    const askQuestionTool = createQuestionTool(model)

    // Create base tools object
    const tools: Record<string, any> = {
      search: searchTool,
      retrieve: retrieveTool,
      videoSearch: videoSearchTool,
      askQuestion: askQuestionTool
    }

    // Add dynamic tools
    dynamicTools.forEach(toolConfig => {
      if (toolConfig.mcpClient) {
        // MCP tool
        tools[toolConfig.name] = createMCPTool(
          toolConfig.name,
          toolConfig.description,
          toolConfig.mcpClient
        )
      } else if (toolConfig.handler) {
        // Custom dynamic tool
        tools[toolConfig.name] = createCustomTool(
          toolConfig.name,
          toolConfig.description,
          toolConfig.handler
        )
      } else {
        console.warn(
          `Dynamic tool ${toolConfig.name} has no handler or MCP client`
        )
      }
    })

    // Get list of all tool names for activeTools
    const allToolNames = Object.keys(tools)
    const activeToolNames = searchMode
      ? allToolNames.filter(
          name =>
            ['search', 'retrieve', 'videoSearch'].includes(name) ||
            name.startsWith('mcp__') ||
            name.startsWith('dynamic__')
        )
      : undefined

    // Return an agent instance
    return new Agent({
      model: getModel(model),
      system: `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      tools,
      activeTools: activeToolNames,
      stopWhen: searchMode ? stepCountIs(10) : stepCountIs(1)
    })
  } catch (error) {
    console.error('Error in researcher with dynamic tools:', error)
    throw error
  }
}
