import type { CaptureResult } from 'posthog-js'

/**
 * Event properties that carry a full page URL. Auth links (invitations,
 * password resets, bootstrap) carry one-time credentials in the `?token=`
 * query parameter, so the parameter is stripped from every event before
 * it leaves the browser. The `Referer` transport header is handled
 * separately via the `Referrer-Policy: no-referrer` header scoped to the
 * `/auth/*` pages, the only pages that carry token-bearing URLs.
 */
const URL_PROPERTIES = ['$current_url', '$referrer'] as const

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

export function scrubTokenFromEvent(
  event: CaptureResult | null
): CaptureResult | null {
  if (!event) {
    return null
  }
  const properties: Record<string, unknown> = { ...event.properties }
  let changed = false
  for (const key of URL_PROPERTIES) {
    const value = properties[key]
    if (typeof value === 'string') {
      const stripped = stripToken(value)
      if (stripped !== null) {
        properties[key] = stripped
        changed = true
      }
    }
  }
  return changed ? { ...event, properties } : event
}
