import { convertToModelMessages, generateText, isStepCount } from 'ai'

import cloudConfig from '@/config/models/cloud.json'

import {
  getAdaptiveModePrompt,
  getQuickModePrompt
} from '@/lib/agents/prompts/search-mode-prompts'
import { buildDraftVersions, currentDraftVersion } from '@/lib/draft/draft'
import { capHistoricalAttachments } from '@/lib/streaming/helpers/cap-historical-attachments'
import { capHistoricalPastedContent } from '@/lib/streaming/helpers/cap-historical-pasted-content'
import { compactHistoricalMessages } from '@/lib/streaming/helpers/compact-historical-messages'
import { convertDataPart } from '@/lib/streaming/helpers/convert-data-part'
import { assignDataPartNonces } from '@/lib/streaming/helpers/data-part-nonce'
import { dedupeAttachments } from '@/lib/streaming/helpers/dedupe-attachments'
import {
  attachCurrentDraft,
  compactDraftsInMessages
} from '@/lib/streaming/helpers/draft-context'
import { stripSpecFromMessages } from '@/lib/streaming/helpers/strip-spec-from-messages'
import { createDraftTools } from '@/lib/tools/draft'
import { createSearchTool } from '@/lib/tools/search'
import { createTodoTools } from '@/lib/tools/todo'
import { getModel } from '@/lib/utils/registry'

import {
  type DraftEditsInput,
  type DraftEditsMode,
  type DraftTurnOutput
} from '../lib/draft-edits'

import {
  createFixtureFetchTool,
  createFixtureSearchTool
} from './fixture-tools'
import { type ProviderOptions } from './run-answer-task'

const MODES = {
  quick: {
    config: cloudConfig.models.quick,
    getPrompt: getQuickModePrompt,
    includeTodoWrite: false
  },
  adaptive: {
    config: cloudConfig.models.adaptive,
    getPrompt: getAdaptiveModePrompt,
    includeTodoWrite: true
  }
} as const

// Both deployed modes run the same model today; each item replays its own
// mode's prompt, tools, and providerOptions.
export const DEFAULT_MODEL = `${MODES.quick.config.providerId}:${MODES.quick.config.id}`

const MAX_STEPS = 20
const DEFAULT_RETRIES = 2

/**
 * Prepare the chat the way the chat route does before the model sees it:
 * compact historical drafts and answers, then attach the current draft to the
 * latest user message.
 */
export function prepareDraftTurn(messages: DraftEditsInput['messages']) {
  const currentDraft = currentDraftVersion(buildDraftVersions(messages))
  const history = dedupeAttachments(
    capHistoricalAttachments(
      compactHistoricalMessages(
        capHistoricalPastedContent(
          compactDraftsInMessages(
            stripSpecFromMessages(assignDataPartNonces(messages))
          )
        )
      )
    )
  )
  return {
    currentDraft,
    messages: attachCurrentDraft(history, currentDraft)
  }
}

export function createDraftTurnTask({
  model,
  tracingEnabled = true,
  retries = DEFAULT_RETRIES
}: {
  /** Overrides the deployed model for every mode. */
  model?: string
  tracingEnabled?: boolean
  retries?: number
} = {}) {
  return async function answer(item: {
    input?: unknown
  }): Promise<DraftTurnOutput> {
    const input = item.input as DraftEditsInput | undefined
    if (!input?.mode || !Array.isArray(input.messages)) {
      throw new Error('Experiment item input must be { mode, messages }')
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await generate(input)
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[eval] attempt ${attempt + 1}/${retries + 1}: ${message}`)
      }
    }
    throw lastError
  }

  async function generate(input: DraftEditsInput): Promise<DraftTurnOutput> {
    const mode = MODES[input.mode as DraftEditsMode]
    const modelId = model ?? `${mode.config.providerId}:${mode.config.id}`
    const prepared = prepareDraftTurn(input.messages)
    if (!prepared.currentDraft) {
      throw new Error('Item has no draft to protect')
    }

    const tools = {
      search: createFixtureSearchTool({
        results: input.results ?? [],
        toModelOutput: createSearchTool(modelId).toModelOutput,
        onQuery: () => {}
      }),
      fetch: createFixtureFetchTool(input.results ?? []),
      ...(mode.includeTodoWrite ? createTodoTools() : {}),
      ...createDraftTools(prepared.currentDraft)
    }

    const result = await generateText({
      model: getModel(modelId),
      instructions: `${mode.getPrompt()}\nCurrent date: ${new Date().toLocaleDateString()}`,
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      providerOptions: mode.config.providerOptions as ProviderOptions,
      messages: await convertToModelMessages(prepared.messages, {
        convertDataPart
      }),
      telemetry: { isEnabled: tracingEnabled, functionId: 'eval-draft-turn' }
    })

    if (result.finishReason === 'tool-calls') {
      throw new Error(`Step cap of ${MAX_STEPS} reached before an answer`)
    }

    const editCalls = result.steps.flatMap(step =>
      step.toolResults
        .filter(toolResult => toolResult.toolName === 'editDraft')
        .map(toolResult => ({
          input: toolResult.input,
          applied: Number(
            (toolResult.output as { applied?: unknown } | undefined)?.applied ??
              0
          )
        }))
    )

    // An edit with no closing sentence is still a complete turn here: what is
    // measured is whether the draft was touched.
    if (result.text.trim() === '' && editCalls.length === 0) {
      throw new Error('Model produced no answer text')
    }

    return { text: result.text, editCalls }
  }
}
