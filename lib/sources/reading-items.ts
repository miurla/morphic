import { z } from 'zod'

import {
  canonicalizeSourceUrl,
  extractSourceDomain,
  normalizeSourceDate,
  normalizeSourceText
} from './source-metadata'

export const READING_ITEM_STATUSES = [
  'unread',
  'reading',
  'read',
  'archived'
] as const

export type ReadingItemStatus = (typeof READING_ITEM_STATUSES)[number]

export interface NormalizedReadingItemInput {
  sourceId?: string
  url: string
  canonicalUrl: string
  title: string
  author?: string
  siteName?: string
  domain?: string
  publishedAt?: string
  summary?: string
  imageUrl?: string
  faviconUrl?: string
  savedFromChatId?: string
}

const MAX_TEXT_LENGTH = 1024
const MAX_SUMMARY_LENGTH = 4096

const readingItemRequestSchema = z.object({
  sourceId: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  url: z.string().trim().max(4096),
  canonicalUrl: z.string().trim().max(4096).optional(),
  title: z.string().trim().max(MAX_TEXT_LENGTH),
  author: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  siteName: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  domain: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  publishedAt: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  summary: z.string().trim().max(MAX_SUMMARY_LENGTH).optional(),
  imageUrl: z.string().trim().max(4096).optional(),
  faviconUrl: z.string().trim().max(4096).optional(),
  savedFromChatId: z.string().trim().max(MAX_TEXT_LENGTH).optional()
})

export const readingStatusSchema = z.enum(READING_ITEM_STATUSES)

export function normalizeReadingItemRequest(
  value: unknown
): NormalizedReadingItemInput | null {
  const parsed = readingItemRequestSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }

  const canonicalUrl =
    canonicalizeSourceUrl(parsed.data.canonicalUrl) ??
    canonicalizeSourceUrl(parsed.data.url)
  if (!canonicalUrl) {
    return null
  }

  const title = normalizeSourceText(parsed.data.title)
  if (!title) {
    return null
  }

  return {
    sourceId: normalizeSourceText(parsed.data.sourceId),
    url: canonicalUrl,
    canonicalUrl,
    title,
    author: normalizeSourceText(parsed.data.author),
    siteName: normalizeSourceText(parsed.data.siteName),
    domain:
      normalizeSourceText(parsed.data.domain) ??
      extractSourceDomain(canonicalUrl),
    publishedAt: normalizeSourceDate(parsed.data.publishedAt),
    summary: normalizeSourceText(parsed.data.summary),
    imageUrl: canonicalizeSourceUrl(parsed.data.imageUrl),
    faviconUrl: canonicalizeSourceUrl(parsed.data.faviconUrl),
    savedFromChatId: normalizeSourceText(parsed.data.savedFromChatId)
  }
}
