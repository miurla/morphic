import { stepCountIs, tool, ToolLoopAgent } from 'ai'

import type { ResearcherTools } from '@/lib/types/agent'
import { type Model } from '@/lib/types/models'

import { createFactCheckTool } from '../tools/factcheck'
import { createFeedTool } from '../tools/feed'
import { fetchTool } from '../tools/fetch'
import { createMapTool } from '../tools/map'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { createSourcePreferencesTool } from '../tools/source-preferences'
import { createResearchSubtaskTool } from '../tools/subtask-agent'
import { createTodoTools } from '../tools/todo'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import {
  getAdaptiveModePrompt,
  QUICK_MODE_PROMPT
} from './prompts/search-mode-prompts'
import { buildOpenRouterServerToolHeaders } from './openrouter-server-tools'
import {
  buildPersonalizationPrompt,
  type PersonalizationSettings
} from './personalization'
import { applyPromptOverrideSync } from './prompt-overrides'

// Enhanced wrapper function with better type safety and streaming support
function wrapSearchToolForQuickMode<
  T extends ReturnType<typeof createSearchTool>
>(originalTool: T): T {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    async *execute(params, context) {
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }

      // Force optimized type for quick mode
      const modifiedParams = {
        ...params,
        type: 'optimized' as const
      }

      // Execute the original tool and pass through all yielded values
      const result = executeFunc(modifiedParams, context)

      // Handle AsyncIterable (streaming) case
      if (
        result &&
        typeof result === 'object' &&
        Symbol.asyncIterator in result
      ) {
        for await (const chunk of result) {
          yield chunk
        }
      } else {
        // Fallback for non-streaming (shouldn't happen with new implementation)
        const finalResult = await result
        yield finalResult || {
          state: 'complete' as const,
          results: [],
          images: [],
          query: params.query,
          number_of_results: 0
        }
      }
    }
  }) as T
}

// Enhanced researcher function with improved type safety using ToolLoopAgent
// Note: abortSignal should be passed to agent.stream() or agent.generate() calls, not to the agent constructor
export function createResearcher({
  model,
  modelConfig,
  parentTraceId,
  searchMode = 'adaptive',
  personalization
}: {
  model: string
  modelConfig?: Model
  parentTraceId?: string
  searchMode?: SearchMode
  personalization?: PersonalizationSettings
}) {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools with proper typing
    const originalSearchTool = createSearchTool(model)
    const askQuestionTool = createQuestionTool(model)
    const todoTools = createTodoTools()
    const researchSubtaskTool = createResearchSubtaskTool(model)
    const feedSearchTool = createFeedTool()
    const mapSearchTool = createMapTool()
    const factCheckTool = createFactCheckTool()
    const sourcePreferencesTool = createSourcePreferencesTool()

    let systemPrompt: string
    let activeToolsList: (keyof ResearcherTools)[] = []
    let maxSteps: number
    let searchTool = originalSearchTool

    // Configure based on search mode
    switch (searchMode) {
      case 'quick':
        console.log(
          '[Researcher] Quick mode: maxSteps=20, tools=[search, fetch, googleFactCheck, sourcePreferences]'
        )
        systemPrompt = applyPromptOverrideSync(QUICK_MODE_PROMPT, 'quick')
        activeToolsList = [
          'search',
          'fetch',
          'googleFactCheck',
          'sourcePreferences'
        ]
        maxSteps = 20
        searchTool = wrapSearchToolForQuickMode(originalSearchTool)
        break

      case 'adaptive':
      default:
        systemPrompt = applyPromptOverrideSync(
          getAdaptiveModePrompt(),
          'adaptive'
        )
        activeToolsList = [
          'search',
          'feedSearch',
          'fetch',
          'todoWrite',
          'researchSubtask',
          'mapSearch',
          'googleFactCheck',
          'sourcePreferences'
        ]
        console.log(
          `[Researcher] Adaptive mode: maxSteps=50, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
        searchTool = originalSearchTool
        break
    }

    const personalizationPrompt = buildPersonalizationPrompt(personalization)
    const routerPrompt = applyPromptOverrideSync(
      'Router model guidance: act as the orchestrator for the answer. For simple questions, search directly and answer with citations. For high-cost, adversarial, multi-domain, or ambiguous questions, use a Fusion-style pattern: gather independent evidence paths with search, feedSearch, fact-checking, and researchSubtask, then synthesize consensus, contradictions, blind spots, and source quality. Before finalizing complex answers, use an Advisor-style self-review: check whether a stronger or more specialized subtask/review pass is warranted, verify citations, and state uncertainty honestly. Do not use extra agents when the task is simple enough for direct search.',
      'router'
    )

    // Build tools object with proper typing
    const tools: ResearcherTools = {
      search: searchTool,
      feedSearch: feedSearchTool,
      mapSearch: mapSearchTool,
      fetch: fetchTool,
      askQuestion: askQuestionTool,
      researchSubtask: researchSubtaskTool,
      googleFactCheck: factCheckTool,
      sourcePreferences: sourcePreferencesTool,
      ...todoTools
    } as ResearcherTools

    // Create ToolLoopAgent with all configuration
    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions: [
        systemPrompt,
        `Current date and time: ${currentDate}`,
        routerPrompt,
        personalizationPrompt,
        'Source preference memory: when the user explicitly says to rely on, prefer, avoid, mute, block, or never use a source/domain/URL, call sourcePreferences to save it before continuing. If the user explicitly scopes that instruction to a topic, subject, or use case, save it with a source preference profile name and profile terms so it only affects matching future searches. Use sourcePreferences list when the user asks what source preferences are remembered. Do not infer durable preferences from one-off citations or casual mentions.'
      ]
        .filter(Boolean)
        .join('\n\n'),
      tools,
      activeTools: activeToolsList,
      stopWhen: stepCountIs(maxSteps),
      ...(modelConfig?.providerOptions && {
        providerOptions: modelConfig.providerOptions
      }),
      prepareCall: options => {
        const headers = new Headers()
        for (const [key, value] of Object.entries(options.headers ?? {})) {
          if (value !== undefined) {
            headers.set(key, value)
          }
        }
        const openRouterHeaders = buildOpenRouterServerToolHeaders(
          modelConfig?.providerId ?? model.split(':')[0],
          options.providerOptions ?? modelConfig?.providerOptions
        )

        for (const [key, value] of Object.entries(openRouterHeaders)) {
          headers.set(key, value)
        }

        return {
          ...options,
          headers: Object.fromEntries(headers.entries())
        }
      },
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

    return agent
  } catch (error) {
    console.error('Error in createResearcher:', error)
    throw error
  }
}

// Helper function to access agent tools
export function getResearcherTools(
  agent: ToolLoopAgent<never, ResearcherTools, never>
): ResearcherTools {
  return agent.tools
}

// Export the legacy function name for backward compatibility
export const researcher = createResearcher
