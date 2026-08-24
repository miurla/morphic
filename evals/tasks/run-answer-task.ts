import { generateText, isStepCount } from 'ai'

import { createSearchTool } from '@/lib/tools/search'
import { createTodoTools } from '@/lib/tools/todo'
import { getModel } from '@/lib/utils/registry'

import { type RelatedQuestionsInput } from '../lib/dataset'

import {
  createFixtureFetchTool,
  createFixtureSearchTool
} from './fixture-tools'

// Narrow enough to satisfy the SDK's JSON-shaped provider options, wide enough
// to carry another provider's settings when a model swap is being evaluated.
export type ProviderOptions = Record<
  string,
  Record<string, string | number | boolean>
>

export type AnswerOutput = {
  text: string
  searchQueries: string[]
  steps: number
}

export type AnswerTaskOptions = {
  model: string
  providerOptions: ProviderOptions
  tracingEnabled: boolean
  retries: number
  maxSteps: number
  getPrompt: () => string
  includeTodoWrite: boolean
  telemetryFunctionId: string
}

export function runAnswerTask({
  model,
  providerOptions,
  tracingEnabled,
  retries,
  maxSteps,
  getPrompt,
  includeTodoWrite,
  telemetryFunctionId
}: AnswerTaskOptions) {
  // Built once: it reaches out to the search provider config, not the network.
  const toModelOutput = createSearchTool(model).toModelOutput

  // The item type is the SDK's union of a local item and a Langfuse dataset
  // item, whose input is `unknown`. Narrowing here is what lets the same task
  // run against a managed dataset later without another code path.
  return async function answer(item: {
    input?: unknown
  }): Promise<AnswerOutput> {
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

  async function generate(input: RelatedQuestionsInput): Promise<AnswerOutput> {
    const searchQueries: string[] = []

    const tools = {
      search: createFixtureSearchTool({
        results: input.results,
        toModelOutput,
        onQuery: query => searchQueries.push(query)
      }),
      fetch: createFixtureFetchTool(input.results),
      ...(includeTodoWrite ? createTodoTools() : {})
    }

    const result = await generateText({
      model: getModel(model),
      instructions: getPrompt(),
      tools,
      stopWhen: isStepCount(maxSteps),
      providerOptions,
      prompt: input.query,
      telemetry: {
        isEnabled: tracingEnabled,
        functionId: telemetryFunctionId
      }
    })

    // A loop cut off at the step cap leaves an answer the model never finished,
    // and an unfinished answer carries no related block for reasons that have
    // nothing to do with the prompt. Reject it so the retry runs and, if it
    // keeps happening, completionRate reports it.
    if (result.finishReason === 'tool-calls') {
      throw new Error(`Step cap of ${maxSteps} reached before an answer`)
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
