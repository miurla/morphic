import type { SourceRetrievalMethod } from './source-types'

const TRACKING_PARAM_PREFIXES = ['utm_']
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'ref',
  'spm'
])

export function normalizeSourceText(value?: string | null): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  return normalized || undefined
}

export function normalizeSourceDate(
  value?: string | Date | null
): string | undefined {
  if (!value) {
    return undefined
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function canonicalizeSourceUrl(
  value?: string | null
): string | undefined {
  const rawUrl = normalizeSourceText(value)
  if (!rawUrl) {
    return undefined
  }

  try {
    const url = new URL(rawUrl)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    url.username = ''
    url.password = ''
    url.hash = ''

    for (const key of Array.from(url.searchParams.keys())) {
      const lowerKey = key.toLowerCase()
      if (
        TRACKING_PARAMS.has(lowerKey) ||
        TRACKING_PARAM_PREFIXES.some(prefix => lowerKey.startsWith(prefix))
      ) {
        url.searchParams.delete(key)
      }
    }

    const sortedParams = Array.from(url.searchParams.entries()).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    )
    url.search = ''
    for (const [key, paramValue] of sortedParams) {
      url.searchParams.append(key, paramValue)
    }

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  } catch {
    return undefined
  }
}

export function extractSourceDomain(value?: string | null): string | undefined {
  const canonicalUrl = canonicalizeSourceUrl(value)
  if (!canonicalUrl) {
    return undefined
  }

  try {
    return new URL(canonicalUrl).hostname
  } catch {
    return undefined
  }
}

function stableHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

export function createSourceId({
  retrievalMethod,
  canonicalUrl,
  title,
  rank
}: {
  retrievalMethod: SourceRetrievalMethod
  canonicalUrl?: string
  title: string
  rank?: number
}): string {
  return `source_${retrievalMethod}_${stableHash(
    [canonicalUrl, title, rank ?? 0].filter(Boolean).join(':')
  )}`
}
