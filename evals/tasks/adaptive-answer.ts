import { generateText, isStepCount, tool } from 'ai'
import { z } from 'zod'

import cloudConfig from '@/config/models/cloud.json'

import { getAdaptiveModePrompt } from '@/lib/agents/prompts/search-mode-prompts'
import { fetchTool } from '@/lib/tools/fetch'
import { createSearchTool } from '@/lib/tools/search'
import { createTodoTools } from '@/lib/tools/todo'
import { getModel } from '@/lib/utils/registry'

import { type RelatedQuestionsInput, type SearchFixture } from '../lib/dataset'

// Narrow enough to satisfy the SDK's JSON-shaped provider options, wide enough
// to carry another provider's settings when a model swap is being evaluated.
type ProviderOptions = Record<string, Record<string, string | number | boolean>>

const ADAPTIVE = cloudConfig.models.adaptive

export const DEFAULT_MODEL = `${ADAPTIVE.providerId}:${ADAPTIVE.id}`
export const DEFAULT_PROVIDER_OPTIONS = ADAPTIVE.providerOptions

// Production allows 50 steps in adaptive mode. The fixture search returns the
// same results every time, so a healthy run converges in a handful of steps;
// this cap only bounds a loop that is going nowhere. A run that hits it is
// rejected rather than measured, see the finish reason check below.
const MAX_STEPS = 20

// The provider intermittently returns a response the SDK cannot parse, at a few
// percent of calls. The experiment runner drops an item whose task throws, so
// without a retry that noise lands directly in the measured rates. The SDK's own
// retry does not cover this error class.
const DEFAULT_RETRIES = 2

export type AdaptiveAnswerOutput = {
  text: string
  searchQueries: string[]
  steps: number
}

/**
 * Replay one query against the deployed adaptive configuration with the search
 * results pinned.
 *
 * Production faithfulness is the point: the same prompt builder, the same
 * providerOptions, and the same `toModelOutput` trimming the real search tool
 * applies. Reasoning effort in particular has moved emission rates before, so a
 * run without providerOptions would measure something the product does not do.
 */
export function createAdaptiveAnswerTask({
  model = DEFAULT_MODEL,
  providerOptions = DEFAULT_PROVIDER_OPTIONS,
  tracingEnabled = true,
  retries = DEFAULT_RETRIES
}: {
  model?: string
  providerOptions?: ProviderOptions
  tracingEnabled?: boolean
  retries?: number
} = {}) {
  // Built once: it reaches out to the search provider config, not the network.
  const toModelOutput = createSearchTool(model).toModelOutput

  // The item type is the SDK's union of a local item and a Langfuse dataset
  // item, whose input is `unknown`. Narrowing here is what lets the same task
  // run against a managed dataset later without another code path.
  return async function adaptiveAnswer(item: {
    input?: unknown
  }): Promise<AdaptiveAnswerOutput> {
    const input = item.input as RelatedQuestionsInput | undefined
    if (!input?.query || !Array.isArray(input.results)) {
      throw new Error('Experiment item input must be { query, results }')
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await generate(input)
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
          `[eval] attempt ${attempt + 1}/${retries + 1} failed for "${input.query}": ${message}`
        )
      }
    }
    throw lastError
  }

  async function generate(
    input: RelatedQuestionsInput
  ): Promise<AdaptiveAnswerOutput> {
    const searchQueries: string[] = []

    const result = await generateText({
      model: getModel(model),
      instructions: getAdaptiveModePrompt(),
      // The adaptive agent activates search, fetch and todoWrite, and the
      // prompt tells the model those tools exist. Handing it only search would
      // force a different trajectory and so a different answer shape, which is
      // the thing being measured. todoWrite is the production tool as-is: its
      // state is per-instance and never leaves the process.
      tools: {
        search: createFixtureSearchTool({
          results: input.results,
          toModelOutput,
          onQuery: query => searchQueries.push(query)
        }),
        fetch: createFixtureFetchTool(input.results),
        ...createTodoTools()
      },
      stopWhen: isStepCount(MAX_STEPS),
      providerOptions,
      prompt: input.query,
      telemetry: {
        isEnabled: tracingEnabled,
        functionId: 'eval-adaptive-answer'
      }
    })

    // A loop cut off at the step cap leaves an answer the model never finished,
    // and an unfinished answer carries no related block for reasons that have
    // nothing to do with the prompt. Reject it so the retry runs and, if it
    // keeps happening, completionRate reports it.
    if (result.finishReason === 'tool-calls') {
      throw new Error(`Step cap of ${MAX_STEPS} reached before an answer`)
    }
    if (result.text.trim() === '') {
      throw new Error('Model produced no answer text')
    }

    return {
      text: result.text,
      searchQueries,
      steps: result.steps.length
    }
  }
}

// Mirrors the production fetch tool's contract while serving the item's own
// fixture, so the model can follow a URL out of the search results without the
// answer depending on what that page says today.
function createFixtureFetchTool(results: SearchFixture[]) {
  return tool({
    description: fetchTool.description,
    inputSchema: fetchTool.inputSchema,
    async execute({ url }: { url: string }) {
      const match = results.find(result => result.url === url)
      return {
        state: 'complete' as const,
        query: url,
        results: match ? [match] : results,
        images: [],
        number_of_results: match ? 1 : results.length
      }
    }
  })
}

function createFixtureSearchTool({
  results,
  toModelOutput,
  onQuery
}: {
  results: SearchFixture[]
  toModelOutput: ReturnType<typeof createSearchTool>['toModelOutput']
  onQuery: (query: string) => void
}) {
  return tool({
    description: 'Search the web for information.',
    inputSchema: z.object({
      query: z.string(),
      type: z.enum(['optimized', 'general']).optional(),
      max_results: z.number().optional()
    }),
    async execute({ query }) {
      onQuery(query)
      return {
        state: 'complete' as const,
        query,
        results,
        images: [],
        number_of_results: results.length,
        toolCallId: 'fixture-search'
      }
    },
    toModelOutput: toModelOutput as never
  })
}
