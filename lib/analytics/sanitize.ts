import type { CaptureResult } from 'posthog-js'

/**
 * posthog-js attaches the page URL (`$current_url`) to every event. Auth
 * links (invitations, password resets, bootstrap) carry one-time
 * credentials in the `?token=` query parameter, so the parameter is
 * stripped from every event before it leaves the browser.
 */
export function scrubTokenFromEvent(
  event: CaptureResult | null
): CaptureResult | null {
  if (!event) {
    return null
  }
  const url = event.properties?.['$current_url']
  if (typeof url !== 'string' || !url.includes('token=')) {
    return event
  }
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('token')) {
      return event
    }
    parsed.searchParams.delete('token')
    return {
      ...event,
      properties: { ...event.properties, $current_url: parsed.toString() }
    }
  } catch {
    return event
  }
}
