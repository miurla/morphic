import { stepCountIs, tool, ToolLoopAgent } from 'ai'

import type { ResearcherTools } from '@/lib/types/agent'
import { type Model } from '@/lib/types/models'

import { enrichQuery } from '../agri/query-enricher'
import { fetchTool } from '../tools/fetch'
import { createQuestionTool } from '../tools/question'
import { createSearchTool, search } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import {
  getAdaptiveModePrompt,
  QUICK_MODE_PROMPT
} from './prompts/search-mode-prompts'

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

// AgriEvidence search wrapper — intercepts every search tool call, enriches the user
// query into 2-3 scientific search terms, runs them in parallel, and yields a merged
// SearchResults object under the original toolCallId so citations stay coherent.
function createAgriSearchTool<T extends ReturnType<typeof createSearchTool>>(
  originalTool: T,
  model: string
): T {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    async *execute(params, context) {
      // params may have optional fields depending on the model schema; cast once
      const p = params as typeof params & {
        max_results?: number
        search_depth?: string
        include_domains?: string[]
        exclude_domains?: string[]
      }

      // Signal the UI that a search is starting with the original user query
      yield {
        state: 'searching' as const,
        query: params.query
      }

      // Rewrite query into 2-3 precise scientific search terms
      const enrichedQueries = await enrichQuery(params.query, model)

      // Run all enriched queries in parallel
      const searchResults = await Promise.all(
        enrichedQueries.map(q =>
          search(
            q,
            p.max_results ?? 10,
            (p.search_depth as 'basic' | 'advanced') ?? 'basic',
            p.include_domains ?? [],
            p.exclude_domains ?? []
          )
        )
      )

      // Merge: deduplicate results by URL, concatenate images
      const seenUrls = new Set<string>()
      const mergedResults: Array<{ title: string; url: string; content: string }> =
        []
      const mergedImages: unknown[] = []
      let totalResults = 0

      for (const result of searchResults) {
        totalResults += result.number_of_results ?? 0
        for (const item of result.results ?? []) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url)
            mergedResults.push(item)
          }
        }
        for (const img of result.images ?? []) {
          mergedImages.push(img)
        }
      }

      // Build citation map (1-based index)
      const citationMap: Record<
        number,
        { title: string; url: string; content: string }
      > = {}
      mergedResults.forEach((item, index) => {
        citationMap[index + 1] = item
      })

      yield {
        state: 'complete' as const,
        results: mergedResults,
        images: mergedImages,
        query: params.query,
        number_of_results: totalResults,
        citationMap,
        ...(context?.toolCallId ? { toolCallId: context.toolCallId } : {})
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
  searchMode = 'adaptive'
}: {
  model: string
  modelConfig?: Model
  parentTraceId?: string
  searchMode?: SearchMode
}) {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools with proper typing
    const originalSearchTool = createSearchTool(model)
    const askQuestionTool = createQuestionTool(model)
    const todoTools = createTodoTools()

    let systemPrompt: string
    let activeToolsList: (keyof ResearcherTools)[] = []
    let maxSteps: number
    let searchTool = originalSearchTool

    // Configure based on search mode
    switch (searchMode) {
      case 'quick':
        console.log(
          '[Researcher] Quick mode: maxSteps=20, tools=[search, fetch]'
        )
        systemPrompt = QUICK_MODE_PROMPT
        activeToolsList = ['search', 'fetch']
        maxSteps = 20
        searchTool = createAgriSearchTool(originalSearchTool, model)
        break

      case 'adaptive':
      default:
        systemPrompt = getAdaptiveModePrompt()
        activeToolsList = ['search', 'fetch', 'todoWrite']
        console.log(
          `[Researcher] Adaptive mode: maxSteps=50, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
        searchTool = createAgriSearchTool(originalSearchTool, model)
        break
    }

    // Build tools object with proper typing
    const tools: ResearcherTools = {
      search: searchTool,
      fetch: fetchTool,
      askQuestion: askQuestionTool,
      ...todoTools
    } as ResearcherTools

    // Create ToolLoopAgent with all configuration
    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      tools,
      activeTools: activeToolsList,
      stopWhen: stepCountIs(maxSteps),
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
