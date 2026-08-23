import cloudConfig from '@/config/models/cloud.json'

import { getQuickModePrompt } from '@/lib/agents/prompts/search-mode-prompts'

import {
  type AnswerOutput,
  type ProviderOptions,
  runAnswerTask
} from './run-answer-task'

const QUICK = cloudConfig.models.quick

export const DEFAULT_MODEL = `${QUICK.providerId}:${QUICK.id}`
export const DEFAULT_PROVIDER_OPTIONS = QUICK.providerOptions

// Production allows 20 steps in quick mode. The fixture search returns the
// same results every time, so a healthy run converges in a handful of steps;
// this cap only bounds a loop that is going nowhere. A run that hits it is
// rejected rather than measured, see the finish reason check in the runner.
const MAX_STEPS = 20

// The provider intermittently returns a response the SDK cannot parse, at a few
// percent of calls. The experiment runner drops an item whose task throws, so
// without a retry that noise lands directly in the measured rates. The SDK's own
// retry does not cover this error class.
const DEFAULT_RETRIES = 2

export type QuickAnswerOutput = AnswerOutput

/**
 * Replay one query against the deployed quick configuration with the search
 * results pinned.
 *
 * Production faithfulness is the point: the same prompt builder, the same
 * providerOptions, and the same `toModelOutput` trimming the real search tool
 * applies. Reasoning effort in particular has moved emission rates before, so a
 * run without providerOptions would measure something the product does not do.
 */
export function createQuickAnswerTask({
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
  return runAnswerTask({
    model,
    providerOptions,
    tracingEnabled,
    retries,
    maxSteps: MAX_STEPS,
    getPrompt: getQuickModePrompt,
    includeTodoWrite: false,
    telemetryFunctionId: 'eval-quick-answer'
  })
}
