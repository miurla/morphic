import type { CaptureResult } from 'posthog-js'

/**
 * Event properties that carry a full page URL, including the landing URL
 * that posthog-js replays as initial and session-entry values. Auth links
 * (invitations, password resets, bootstrap) carry one-time credentials in
 * the `?token=` query parameter, so the parameter is stripped from every
 * event before it leaves the browser. The `Referer` transport header is
 * handled separately via the `Referrer-Policy: no-referrer` header scoped
 * to the `/auth/*` pages, the only pages that carry token-bearing URLs.
 */
const URL_PROPERTIES = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$session_entry_url',
  '$session_entry_referrer'
] as const

// posthog-js emits person properties at the event root; site apps and
// manual captures nest them under properties.
const PERSON_PROPERTY_KEYS = ['$set', '$set_once'] as const

function stripToken(url: string): string | null {
  if (!url.includes('token=')) {
    return null
  }
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('token')) {
      return null
    }
    parsed.searchParams.delete('token')
    return parsed.toString()
  } catch {
    return null
  }
}

function scrubUrls<T extends Record<string, unknown>>(source: T): T {
  let scrubbed = source
  for (const key of URL_PROPERTIES) {
    const value = source[key]
    if (typeof value !== 'string') {
      continue
    }
    const stripped = stripToken(value)
    if (stripped !== null) {
      if (scrubbed === source) {
        scrubbed = { ...source }
      }
      ;(scrubbed as Record<string, unknown>)[key] = stripped
    }
  }
  return scrubbed
}

function scrubPersonProperties<T extends Record<string, unknown>>(
  source: T
): T {
  let scrubbed = source
  for (const key of PERSON_PROPERTY_KEYS) {
    const value = source[key]
    if (!value || typeof value !== 'object') {
      continue
    }
    const stripped = scrubUrls(value as Record<string, unknown>)
    if (stripped !== value) {
      if (scrubbed === source) {
        scrubbed = { ...source }
      }
      ;(scrubbed as Record<string, unknown>)[key] = stripped
    }
  }
  return scrubbed
}

export function scrubTokenFromEvent(
  event: CaptureResult | null
): CaptureResult | null {
  if (!event) {
    return null
  }
  const scrubbed = scrubPersonProperties(
    event as unknown as Record<string, unknown>
  ) as unknown as CaptureResult
  const source: Record<string, unknown> = event.properties ?? {}
  const properties = scrubPersonProperties(scrubUrls(source))
  return properties === source ? scrubbed : { ...scrubbed, properties }
}
