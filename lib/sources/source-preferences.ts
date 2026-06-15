import type { SearchResultItem } from '@/lib/types'

import {
  canonicalizeSourceUrl,
  extractSourceDomain,
  normalizeSourceText
} from './source-metadata'

export const SOURCE_PREFERENCES = ['trust', 'prefer', 'mute', 'block'] as const

export type SourcePreference = (typeof SOURCE_PREFERENCES)[number]
export type SourcePreferenceTargetType = 'domain' | 'url'

export interface NormalizedSourcePreferenceInput {
  target: string
  targetType: SourcePreferenceTargetType
  domain: string
  preference: SourcePreference
  note?: string
  profileId?: string
}

export interface SourcePreferenceRecord {
  id: string
  domain: string
  preference: SourcePreference
  target?: string | null
  targetType?: SourcePreferenceTargetType | null
  note?: string | null
  profileId?: string | null
}

export interface SourcePreferenceMatch {
  preference: SourcePreference
  matchedBy: SourcePreferenceTargetType
  matchedValue: string
}

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/i

const PREFERENCE_WEIGHTS: Record<SourcePreference, number> = {
  trust: 200,
  prefer: 100,
  mute: -1000,
  block: Number.NEGATIVE_INFINITY
}

function isSourcePreference(value: unknown): value is SourcePreference {
  return (
    typeof value === 'string' &&
    SOURCE_PREFERENCES.includes(value as SourcePreference)
  )
}

function normalizeDomain(value: string): string | undefined {
  const domain = value.trim().toLowerCase().replace(/\.+$/, '')
  if (!DOMAIN_PATTERN.test(domain)) {
    return undefined
  }

  return domain
}

function normalizeTarget(value: string):
  | {
      target: string
      targetType: SourcePreferenceTargetType
      domain: string
    }
  | undefined {
  const rawTarget = normalizeSourceText(value)
  if (!rawTarget) {
    return undefined
  }

  const canonicalUrl = canonicalizeSourceUrl(rawTarget)
  if (canonicalUrl) {
    const domain = extractSourceDomain(canonicalUrl)
    if (!domain) {
      return undefined
    }

    return {
      target: canonicalUrl,
      targetType: 'url',
      domain
    }
  }

  if (
    rawTarget.includes(':') ||
    rawTarget.includes('/') ||
    /\s/.test(rawTarget)
  ) {
    return undefined
  }

  const domain = normalizeDomain(rawTarget)
  if (!domain) {
    return undefined
  }

  return {
    target: domain,
    targetType: 'domain',
    domain
  }
}

export function normalizeSourcePreferenceInput(
  value: unknown
): NormalizedSourcePreferenceInput | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const input = value as {
    target?: unknown
    preference?: unknown
    note?: unknown
    profileId?: unknown
  }

  if (
    typeof input.target !== 'string' ||
    !isSourcePreference(input.preference)
  ) {
    return null
  }

  const target = normalizeTarget(input.target)
  if (!target) {
    return null
  }

  const note =
    typeof input.note === 'string' ? normalizeSourceText(input.note) : undefined

  return {
    ...target,
    preference: input.preference,
    ...(typeof input.profileId === 'string' &&
      /^[a-z0-9_-]{8,191}$/i.test(input.profileId.trim()) && {
        profileId: input.profileId.trim()
      }),
    ...(note && { note })
  }
}

function matchesDomain(sourceDomain: string, preferredDomain: string): boolean {
  return (
    sourceDomain === preferredDomain ||
    sourceDomain.endsWith(`.${preferredDomain}`)
  )
}

function matchPreference(
  result: SearchResultItem,
  preferences: SourcePreferenceRecord[]
): SourcePreferenceMatch | null {
  const canonicalUrl = canonicalizeSourceUrl(result.url)
  const sourceDomain = extractSourceDomain(result.url)
  if (!sourceDomain) {
    return null
  }

  const matches: SourcePreferenceMatch[] = []
  for (const preference of preferences) {
    if (
      preference.targetType === 'url' &&
      preference.target &&
      canonicalUrl === preference.target
    ) {
      matches.push({
        preference: preference.preference,
        matchedBy: 'url',
        matchedValue: preference.target
      })
      continue
    }

    if (matchesDomain(sourceDomain, preference.domain)) {
      matches.push({
        preference: preference.preference,
        matchedBy: 'domain',
        matchedValue: preference.domain
      })
    }
  }

  if (matches.some(match => match.preference === 'block')) {
    return matches.find(match => match.preference === 'block') ?? null
  }

  return (
    matches.sort(
      (left, right) =>
        PREFERENCE_WEIGHTS[right.preference] -
        PREFERENCE_WEIGHTS[left.preference]
    )[0] ?? null
  )
}

export function applySourcePreferencesToSearchResults(
  results: SearchResultItem[],
  preferences: SourcePreferenceRecord[]
): SearchResultItem[] {
  if (preferences.length === 0 || results.length === 0) {
    return results
  }

  return results
    .map((result, index) => {
      const match = matchPreference(result, preferences)
      return {
        result,
        index,
        match,
        score: match ? PREFERENCE_WEIGHTS[match.preference] : 0
      }
    })
    .filter(item => item.score !== Number.NEGATIVE_INFINITY)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(item => ({
      ...item.result,
      ...(item.match && { sourcePreference: item.match })
    }))
}
