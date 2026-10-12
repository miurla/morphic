const ASSET_SEGMENTS = new Set(['static', 'array'])
const ASSET_HOST = 'us-assets.i.posthog.com'
const API_HOST = 'us.i.posthog.com'

export const RELAY_PREFIX = '/relay'

/**
 * Maps a path below /relay to its PostHog upstream URL. Returns null when
 * the path resolves off the PostHog origin (e.g. a protocol-relative path
 * built from an encoded slash).
 */
export function relayTarget(path: string, search = ''): URL | null {
  const host = ASSET_SEGMENTS.has(path.split('/')[1]) ? ASSET_HOST : API_HOST
  const target = new URL(path, `https://${host}`)
  if (target.host !== host) {
    return null
  }
  target.search = search
  return target
}
