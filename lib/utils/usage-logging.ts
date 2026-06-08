// Token usage / prompt-cache logging utilities.
//
// The AI SDK normalizes every provider's cache accounting onto
// LanguageModelUsage.inputTokenDetails.cacheReadTokens. For Gemini this comes
// from usage.cachedContentTokenCount (implicit caching), so cache hits are
// observable without any explicit cache setup. Enable with
// ENABLE_USAGE_LOGGING=true to measure cache hit rate across a session.

import type { LanguageModelUsage, ProviderMetadata } from 'ai'

const isUsageLoggingEnabled = process.env.ENABLE_USAGE_LOGGING === 'true'

export function isUsageLogging(): boolean {
  return isUsageLoggingEnabled
}

interface UsageLogContext {
  // Free-form scope label, e.g. "step" or "total".
  scope: string
  modelId?: string
  // Step index for per-step logs (onStepFinish).
  step?: number
}

function pct(part: number | undefined, whole: number | undefined): string {
  if (!whole || whole <= 0 || part == null) return 'n/a'
  return `${((part / whole) * 100).toFixed(1)}%`
}

// logUsage prints a single normalized usage line. cacheRead/cacheWrite come from
// inputTokenDetails; the hit rate is cacheRead / inputTokens.
export function logUsage(
  ctx: UsageLogContext,
  usage: LanguageModelUsage,
  providerMetadata?: ProviderMetadata
) {
  if (!isUsageLoggingEnabled) return

  const input = usage.inputTokens
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens
  const reasoning = usage.outputTokenDetails?.reasoningTokens

  const parts = [
    `scope=${ctx.scope}`,
    ctx.step != null ? `step=${ctx.step}` : null,
    ctx.modelId ? `model=${ctx.modelId}` : null,
    `input=${input ?? '?'}`,
    `cacheRead=${cacheRead ?? 0}`,
    `cacheWrite=${cacheWrite ?? 0}`,
    `hitRate=${pct(cacheRead, input)}`,
    `output=${usage.outputTokens ?? '?'}`,
    reasoning != null ? `reasoning=${reasoning}` : null,
    `total=${usage.totalTokens ?? '?'}`
  ].filter(Boolean)

  console.log(`[USAGE] ${parts.join(' ')}`)

  // Gemini reports nothing beyond cachedContentTokenCount today, but dump the
  // raw provider metadata when present so we can spot fields the SDK does not
  // yet normalize.
  if (providerMetadata) {
    console.log(`[USAGE] ${ctx.scope} providerMetadata=`, providerMetadata)
  }
}

// Rough byte-based token estimate (~4 chars/token). Good enough for relative
// payload breakdowns; avoids pulling a tokenizer into the tool path.
function estTokens(value: unknown): number {
  if (value == null) return 0
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return Math.ceil(s.length / 4)
}

// logToolPayload reports the token weight of what a tool injects into the next
// request, broken down by sub-field. This is how we see which part of the
// 100K+ input prompt is the real cost driver (search results vs the duplicated
// citationMap vs fetched page bodies).
export function logToolPayload(
  toolName: string,
  query: string | undefined,
  breakdown: Record<string, unknown>
) {
  if (!isUsageLoggingEnabled) return

  const total = estTokens(breakdown)
  const parts = Object.entries(breakdown).map(
    ([k, v]) => `${k}=${estTokens(v)}`
  )
  console.log(
    `[PAYLOAD] tool=${toolName}${query ? ` q="${query.slice(0, 40)}"` : ''} total≈${total} ${parts.join(' ')}`
  )
}
