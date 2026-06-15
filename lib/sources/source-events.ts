import { z } from 'zod'

import {
  canonicalizeSourceUrl,
  extractSourceDomain,
  normalizeSourceText
} from './source-metadata'

export const SOURCE_EVENT_TYPES = [
  'impression',
  'open_original',
  'open_reader',
  'save',
  'copy_link',
  'report'
] as const

export type SourceEventType = (typeof SOURCE_EVENT_TYPES)[number]

export type SourceEventMetadata = {
  sourceKind?: string
  provider?: string
  retrievalMethod?: string
  rank?: number
}

export interface NormalizedSourceEventInput {
  eventType: SourceEventType
  sourceId?: string
  chatId?: string
  sourceUrl: string
  sourceDomain: string
  pageUrl?: string
  metadata?: SourceEventMetadata
}

const MAX_METADATA_BYTES = 4096
const MAX_TEXT_LENGTH = 256
const MAX_PAGE_URL_LENGTH = 2048

const sourceEventRequestSchema = z.object({
  eventType: z.enum(SOURCE_EVENT_TYPES),
  sourceId: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  chatId: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  sourceUrl: z.string().trim().max(MAX_PAGE_URL_LENGTH),
  pageUrl: z.string().trim().max(MAX_PAGE_URL_LENGTH).optional(),
  metadata: z.unknown().optional()
})

function sanitizeMetadata(value: unknown): SourceEventMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  if (JSON.stringify(value).length > MAX_METADATA_BYTES) {
    return undefined
  }

  const input = value as Record<string, unknown>
  const metadata: SourceEventMetadata = {}

  for (const key of ['sourceKind', 'provider', 'retrievalMethod'] as const) {
    const text = normalizeSourceText(
      typeof input[key] === 'string' ? input[key] : undefined
    )
    if (text) {
      metadata[key] = text.slice(0, MAX_TEXT_LENGTH)
    }
  }

  if (typeof input.rank === 'number' && Number.isFinite(input.rank)) {
    metadata.rank = Math.max(0, Math.trunc(input.rank))
  }

  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    return undefined
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function sanitizePageUrl(value?: string): string | undefined {
  const pageUrl = normalizeSourceText(value)
  if (!pageUrl) {
    return undefined
  }

  try {
    if (pageUrl.startsWith('/')) {
      const parsed = new URL(pageUrl, 'https://morphic.local')
      return parsed.pathname.slice(0, MAX_PAGE_URL_LENGTH)
    }

    const parsed = new URL(pageUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined
    }

    return parsed.pathname.slice(0, MAX_PAGE_URL_LENGTH)
  } catch {
    return undefined
  }
}

export function normalizeSourceEventRequest(
  value: unknown
): NormalizedSourceEventInput | null {
  const parsed = sourceEventRequestSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }

  const sourceUrl = canonicalizeSourceUrl(parsed.data.sourceUrl)
  const sourceDomain = extractSourceDomain(sourceUrl)
  if (!sourceUrl || !sourceDomain) {
    return null
  }

  const metadata = sanitizeMetadata(parsed.data.metadata)
  if (parsed.data.metadata && !metadata) {
    return null
  }

  return {
    eventType: parsed.data.eventType,
    sourceId: normalizeSourceText(parsed.data.sourceId),
    chatId: normalizeSourceText(parsed.data.chatId),
    sourceUrl,
    sourceDomain,
    pageUrl: sanitizePageUrl(parsed.data.pageUrl),
    metadata
  }
}
