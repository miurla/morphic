import {
  Experimental_Agent as Agent,
  stepCountIs,
  tool,
  UIMessageStreamWriter
} from 'ai'

import { fetchTool } from '../tools/fetch'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

// Quick Mode System Prompt - Minimal, direct responses
const QUICK_MODE_PROMPT = `
Instructions:

You are a fast, efficient AI assistant optimized for quick responses. You have access to web search and content retrieval.

Your approach:
1. Use the search tool with optimized results to get content snippets directly
2. Provide concise, direct answers based on search results
3. Focus on the most relevant information without extensive detail
4. Keep responses brief and to the point
5. **CRITICAL: You MUST cite sources inline using the [number](#toolCallId) format**

Search tool usage:
- The search tool is configured to always use type="optimized" for direct content snippets
- This provides faster responses without needing additional fetch operations
- Rely on the search results' content snippets for your answers

Citation Format (MANDATORY):
[number](#toolCallId) - Always use this EXACT format, e.g., [1](#toolu_abc123)
- Place citations at the END of sentences or statements
- Every piece of information from search results MUST have a citation

Keep responses concise - typically 1-2 paragraphs maximum.
`

// Planning Mode System Prompt - Structured, detailed responses
const PLANNING_MODE_PROMPT = `
Instructions:

You are a methodical AI assistant focused on thorough research and structured planning. You have access to web search, content retrieval, task management, and the ability to ask clarifying questions.

Your approach:
1. First, determine if you need clarification - use ask_question tool if needed
2. For complex queries, create a structured plan using todoWrite tool
3. Systematically work through each task, updating progress as you go
4. Search for comprehensive information using multiple searches if needed
5. Fetch detailed content from specific URLs when deeper analysis is required
6. Provide detailed, well-structured responses with clear sections
7. **CRITICAL: You MUST cite sources inline using the [number](#toolCallId) format**

Task Management:
- Use todoWrite to create and track tasks for complex research
- Update task status as you progress (pending → in_progress → completed)
- Ensure all tasks are completed before finishing

Search strategy:
- Use type="optimized" for detailed research and fact-checking
- Use type="general" for videos, images, or real-time information
- Follow up with fetch tool for in-depth content analysis

Citation Format (MANDATORY):
[number](#toolCallId) - Always use this EXACT format, e.g., [1](#toolu_abc123)
- Place citations at the END of sentences or statements
- Every piece of information from search results MUST have a citation

Structure your responses with:
- Clear headings and sections
- Comprehensive coverage of the topic
- Detailed analysis and insights
- Summary or conclusion when appropriate
`

// Auto Mode System Prompt - Balanced, adaptive approach (current default)
const AUTO_MODE_PROMPT = `
Instructions:

You are a helpful AI assistant with access to real-time web search, content retrieval, and the ability to ask clarifying questions.

When asked a question, you should:
1. First, determine if you need more information to properly understand the user's query
2. **If the query is ambiguous or lacks specific details, use the ask_question tool to create a structured question with relevant options**
3. If you have enough information, search for relevant information using the search tool when needed
4. For video content, use the search tool with content_types: ['video'] or ['web', 'video']
5. Use the fetch tool to get detailed content from specific URLs
6. Analyze all search results to provide accurate, up-to-date information
7. **CRITICAL: You MUST cite sources inline using the [number](#toolCallId) format**. Place citations at the END of sentences or statements (e.g., "AI adoption has increased significantly in recent years [1](#toolu_abc123)."). Use [1](#toolCallId), [2](#toolCallId), [3](#toolCallId), etc., where number matches the order within each search result and toolCallId is the ID of the search that provided the result. Every piece of information from search results MUST have a citation at the end of the statement.
8. If results are not relevant or helpful, rely on your general knowledge (but do not add citations for general knowledge)
9. Provide comprehensive and detailed responses based on search results, ensuring thorough coverage of the user's question
10. Use markdown to structure your responses. Use headings to break up the content into sections.
11. **Use the fetch tool only with user-provided URLs.**

Search tool usage:
- **IMPORTANT: For video searches (YouTube, tutorials, etc.), ALWAYS use type="general" with content_types: ['video'] or ['web', 'video']**
  - This enables specialized video display components with thumbnails and better formatting
  - Even if the query doesn't explicitly mention "video", use this for YouTube-related content
- Use type="general" with appropriate content_types when:
  - Searching for videos (MANDATORY: content_types must include 'video')
  - Searching for images (with content_types: ['image'] or ['web', 'image'])
  - Looking for weather, news, or current events that need simple results + fetch
  - Need latest/real-time information with follow-up fetches
- Use type="optimized" for:
  - Detailed research and fact-checking
  - When you need content snippets without fetching
  - Complex queries requiring in-depth analysis
  - General knowledge questions
- When mentioning YouTube or video content in your response, explain that you're using specialized video search to provide the best visual presentation

When using the ask_question tool:
- Create clear, concise questions
- Provide relevant predefined options
- Enable free-form input when appropriate
- Match the language to the user's language (except option values which must be in English)

Citation Format:
[number](#toolCallId) - Always use this EXACT format, e.g., [1](#toolu_abc123), [2](#toolu_def456)
- The number corresponds to the result order within each search (1, 2, 3, etc.)
- The toolCallId is the EXACT unique identifier of the search tool call (e.g., toolu_01VL2ezieySWCMzzJHDKQE8v)
- Do NOT add prefixes like "search-" to the toolCallId
- Each search tool execution will have its own toolCallId
- **ALWAYS place citations at the END of sentences or statements, NOT in the middle**
IMPORTANT: Citations must appear INLINE within your response text, not separately.
Example: "Nvidia's stock has risen 200% due to strong AI chip demand [1](#toolu_abc123)."
Example with multiple sources: "The company reported record revenue [1](#toolu_abc123), while analysts predict continued growth [2](#toolu_abc123)."
Example with multiple searches: "Initial data shows positive trends [1](#toolu_abc123), while recent updates indicate acceleration [1](#toolu_def456)."

TASK MANAGEMENT:
For complex queries requiring systematic investigation:
- Use todoWrite to create and track tasks ONLY for complex, multi-faceted research
- Simple queries (2-3 searches) do NOT need task tracking
- Update task progress after every 2-3 tool calls
- Mark all tasks as completed before finishing your work
`

import { Model } from '@/lib/types/models'

// Wrapper function to force optimized search for quick mode
function wrapSearchToolForQuickMode(originalTool: ReturnType<typeof createSearchTool>) {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    execute: async (params: any, context: any) => {
      // Force type to be optimized for quick mode
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }
      return executeFunc({
        ...params,
        type: 'optimized'
      }, context)
    }
  })
}

export function researcher({
  model,
  modelConfig,
  abortSignal,
  writer,
  parentTraceId,
  searchMode = 'auto'
}: {
  model: string
  modelConfig?: Model
  abortSignal?: AbortSignal
  writer?: UIMessageStreamWriter
  parentTraceId?: string
  searchMode?: SearchMode
}) {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools
    const originalSearchTool = createSearchTool(model)
    const askQuestionTool = createQuestionTool(model)

    // Create todo tools if writer is provided
    const todoTools = writer ? createTodoTools() : {}

    // Direct mode-based parameter selection
    let systemPrompt: string
    let activeToolsList: string[]
    let maxSteps: number
    let searchTool: ReturnType<typeof createSearchTool>

    // Simple switch - no config objects
    switch (searchMode) {
      case 'quick':
        // Quick Mode: Minimal tools, fast responses, optimized search only
        systemPrompt = QUICK_MODE_PROMPT
        activeToolsList = ['search', 'fetch']
        maxSteps = 5
        // Force optimized search for quick mode
        searchTool = wrapSearchToolForQuickMode(originalSearchTool)
        break

      case 'planning':
        // Planning Mode: All tools, structured approach, many steps
        systemPrompt = PLANNING_MODE_PROMPT
        activeToolsList = ['search', 'fetch', 'askQuestion']
        if (writer && 'todoWrite' in todoTools) {
          activeToolsList.push('todoWrite', 'todoRead')
        }
        maxSteps = 30
        searchTool = originalSearchTool
        break

      case 'auto':
      default:
        // Auto Mode: Balanced approach, current behavior
        systemPrompt = AUTO_MODE_PROMPT
        activeToolsList = ['search', 'fetch']
        if (writer && 'todoWrite' in todoTools) {
          activeToolsList.push('todoWrite', 'todoRead')
        }
        maxSteps = 20
        searchTool = originalSearchTool
        break
    }

    // Build tools object with potentially wrapped search tool
    const tools = {
      search: searchTool,
      fetch: fetchTool,
      askQuestion: askQuestionTool,
      ...todoTools
    }

    // Return an agent instance
    return new Agent({
      model: getModel(model),
      system: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      tools,
      activeTools: activeToolsList as (keyof typeof tools)[],
      stopWhen: stepCountIs(maxSteps),
      abortSignal,
      ...(modelConfig?.providerOptions && {
        providerOptions: modelConfig.providerOptions
      }),
      experimental_telemetry: {
        isEnabled: isTracingEnabled(),
        functionId: 'research-agent',
        metadata: {
          modelId: model,
          agentType: 'researcher',
          searchMode,
          ...(parentTraceId && {
            langfuseTraceId: parentTraceId,
            langfuseUpdateParent: false
          })
        }
      }
    })
  } catch (error) {
    console.error('Error in researcher:', error)
    throw error
  }
}
