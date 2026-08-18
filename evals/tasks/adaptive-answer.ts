import { generateText, isStepCount, tool } from 'ai'
import { z } from 'zod'

import cloudConfig from '@/config/models/cloud.json'

import { getAdaptiveModePrompt } from '@/lib/agents/prompts/search-mode-prompts'
import { createSearchTool } from '@/lib/tools/search'
import { getModel } from '@/lib/utils/registry'

import { type RelatedQuestionsInput, type SearchFixture } from '../lib/dataset'

// Narrow enough to satisfy the SDK's JSON-shaped provider options, wide enough
// to carry another provider's settings when a model swap is being evaluated.
type ProviderOptions = Record<string, Record<string, string | number | boolean>>

const ADAPTIVE = cloudConfig.models.adaptive

export const DEFAULT_MODEL = `${ADAPTIVE.providerId}:${ADAPTIVE.id}`
export const DEFAULT_PROVIDER_OPTIONS = ADAPTIVE.providerOptions

// The answer only needs to reach a conclusion, not to research exhaustively.
// A low cap keeps a runaway loop from dominating the run's cost.
const MAX_STEPS = 6

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
      tools: {
        search: createFixtureSearchTool({
          results: input.results,
          toModelOutput,
          onQuery: query => searchQueries.push(query)
        })
      },
      stopWhen: isStepCount(MAX_STEPS),
      providerOptions,
      prompt: input.query,
      telemetry: {
        isEnabled: tracingEnabled,
        functionId: 'eval-adaptive-answer'
      }
    })

    return {
      text: result.text,
      searchQueries,
      steps: result.steps.length
    }
  }
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
