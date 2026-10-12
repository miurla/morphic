const ASSET_SEGMENTS = new Set(['static', 'array'])
const ASSET_HOST = 'us-assets.i.posthog.com'
const API_HOST = 'us.i.posthog.com'

export const RELAY_PREFIX = '/relay'
export const RELAY_MAX_BODY_BYTES = 32 * 1024 * 1024

export function exceedsRelayBodyCap(headers: Headers): boolean {
  const declared = Number(headers.get('content-length'))
  return Number.isFinite(declared) && declared > RELAY_MAX_BODY_BYTES
}

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
