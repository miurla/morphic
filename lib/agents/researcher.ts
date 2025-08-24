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
  AUTO_MODE_PROMPT,
  PLANNING_MODE_PROMPT,
  QUICK_MODE_PROMPT
} from './prompts/search-mode-prompts'

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
