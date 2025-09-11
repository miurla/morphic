import {
  Experimental_Agent as Agent,
  stepCountIs,
  tool,
  UIMessageStreamWriter
} from 'ai'

import { Model } from '@/lib/types/models'

import { fetchTool } from '../tools/fetch'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import {
  ADAPTIVE_MODE_PROMPT,
  PLANNING_MODE_PROMPT,
  QUICK_MODE_PROMPT
} from './prompts/search-mode-prompts'

// Wrapper function to force optimized search for quick mode
function wrapSearchToolForQuickMode(
  originalTool: ReturnType<typeof createSearchTool>
): ReturnType<typeof createSearchTool> {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    execute: async (params: any, context: any) => {
      // Force type to be optimized for quick mode
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }
      const result = await executeFunc(
        {
          ...params,
          type: 'optimized'
        },
        context
      )

      // Handle AsyncIterable case
      if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        // Collect all results from the async iterable
        let searchResults: any = null
        for await (const chunk of result) {
          searchResults = chunk
        }
        return searchResults || { results: [], images: [], query: params.query, number_of_results: 0 }
      }

      return result || { results: [], images: [], query: params.query, number_of_results: 0 }
    }
  }) as ReturnType<typeof createSearchTool>
}

export function researcher({
  model,
  modelConfig,
  abortSignal,
  writer,
  parentTraceId,
  searchMode = 'adaptive'
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
    console.log(`[Researcher] Executing in ${searchMode} mode`)

    switch (searchMode) {
      case 'quick':
        // Quick Mode: Minimal tools, fast responses, optimized search only
        console.log(
          '[Researcher] Quick mode: maxSteps=5, tools=[search, fetch]'
        )
        systemPrompt = QUICK_MODE_PROMPT
        activeToolsList = ['search', 'fetch']
        maxSteps = 5
        // Force optimized search for quick mode
        searchTool = wrapSearchToolForQuickMode(originalSearchTool)
        break

      case 'planning':
        // Planning Mode: All tools, structured approach, many steps
        systemPrompt = PLANNING_MODE_PROMPT
        activeToolsList = ['search', 'fetch'] // Temporarily removed askQuestion until improvements
        if (writer && 'todoWrite' in todoTools) {
          activeToolsList.push('todoWrite', 'todoRead')
        }
        console.log(
          `[Researcher] Planning mode: maxSteps=50, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
        searchTool = originalSearchTool
        break

      case 'adaptive':
      default:
        // Adaptive Mode: Balanced approach, current behavior
        systemPrompt = ADAPTIVE_MODE_PROMPT
        activeToolsList = ['search', 'fetch']
        if (writer && 'todoWrite' in todoTools) {
          activeToolsList.push('todoWrite', 'todoRead')
        }
        console.log(
          `[Researcher] Adaptive mode: maxSteps=50, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
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

    // Check if we should force todoWrite on first step
    const shouldForceTodoWrite =
      searchMode === 'planning' && writer && 'todoWrite' in todoTools

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
      // Force todoWrite tool on first step for planning mode
      ...(shouldForceTodoWrite && {
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 0) {
            return {
              toolChoice: { type: 'tool', toolName: 'todoWrite' }
            }
          }
          return undefined
        }
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
