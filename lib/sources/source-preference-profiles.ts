import { normalizeSourceText } from './source-metadata'
import type { SourcePreferenceRecord } from './source-preferences'

export interface SourcePreferenceProfileSettings {
  includeTerms: string[]
  excludeTerms: string[]
}

export interface SourcePreferenceProfileRecord {
  id: string
  name: string
  slug: string
  description?: string | null
  settings: SourcePreferenceProfileSettings
  isActive?: boolean | null
}

export interface NormalizedSourcePreferenceProfileInput {
  name: string
  slug: string
  description?: string
  settings: SourcePreferenceProfileSettings
  isActive: boolean
}

const MAX_PROFILE_TERMS = 16
const TERM_PATTERN = /^[a-z0-9][a-z0-9+#.-]{1,63}$/i

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

function normalizeTerms(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  const terms = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const normalized = normalizeSourceText(value)?.toLowerCase()
    if (!normalized || !TERM_PATTERN.test(normalized)) {
      continue
    }

    terms.add(normalized)
    if (terms.size >= MAX_PROFILE_TERMS) {
      break
    }
  }

  return Array.from(terms)
}

function termsFromName(name: string): string[] {
  return normalizeTerms(
    name
      .toLowerCase()
      .split(/\s+/)
      .map(term => term.replace(/[^a-z0-9+#.-]/gi, ''))
  )
}

export function normalizeSourcePreferenceProfileInput(
  value: unknown
): NormalizedSourcePreferenceProfileInput | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const input = value as {
    name?: unknown
    description?: unknown
    includeTerms?: unknown
    excludeTerms?: unknown
    isActive?: unknown
  }

  if (typeof input.name !== 'string') {
    return null
  }

  const name = normalizeSourceText(input.name)
  if (!name) {
    return null
  }

  const slug = slugify(name)
  if (!slug) {
    return null
  }

  const includeTerms = normalizeTerms(input.includeTerms)
  const settings = {
    includeTerms: includeTerms.length > 0 ? includeTerms : termsFromName(name),
    excludeTerms: normalizeTerms(input.excludeTerms)
  }

  if (settings.includeTerms.length === 0) {
    return null
  }

  const description =
    typeof input.description === 'string'
      ? normalizeSourceText(input.description)
      : undefined

  return {
    name,
    slug,
    ...(description && { description }),
    settings,
    isActive: typeof input.isActive === 'boolean' ? input.isActive : true
  }
}

export function selectSourcePreferenceProfileForQuery(
  query: string,
  profiles: SourcePreferenceProfileRecord[]
): SourcePreferenceProfileRecord | null {
  const normalizedQuery = ` ${query.toLowerCase()} `
  let best:
    | {
        profile: SourcePreferenceProfileRecord
        score: number
      }
    | undefined

  for (const profile of profiles) {
    if (profile.isActive === false) {
      continue
    }

    if (
      profile.settings.excludeTerms.some(term =>
        normalizedQuery.includes(` ${term.toLowerCase()} `)
      )
    ) {
      continue
    }

    const score = profile.settings.includeTerms.reduce(
      (count, term) =>
        normalizedQuery.includes(` ${term.toLowerCase()} `) ? count + 1 : count,
      0
    )

    if (score > 0 && (!best || score > best.score)) {
      best = { profile, score }
    }
  }

  return best?.profile ?? null
}

export function getEffectiveSourcePreferencesForQuery(
  preferences: SourcePreferenceRecord[],
  profiles: SourcePreferenceProfileRecord[],
  query: string
): SourcePreferenceRecord[] {
  const profile = selectSourcePreferenceProfileForQuery(query, profiles)
  return preferences.filter(preference => {
    if (!preference.profileId) {
      return true
    }

    return Boolean(profile && preference.profileId === profile.id)
  })
}
