const ASSET_SEGMENTS = new Set(['static', 'array'])
const ASSET_HOST = 'us-assets.i.posthog.com'
const API_HOST = 'us.i.posthog.com'

export const RELAY_PREFIX = '/relay'
// Kept below the body size Next buffers for proxied requests.
export const RELAY_MAX_BODY_BYTES = 8 * 1024 * 1024

const FORWARDED_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'content-encoding',
  'content-length',
  'content-type',
  'if-modified-since',
  'if-none-match',
  'user-agent',
  'x-forwarded-for'
]

/** Request headers PostHog needs. Credentials are never among them. */
export function relayRequestHeaders(incoming: Headers): Headers {
  const headers = new Headers()
  for (const name of FORWARDED_HEADERS) {
    const value = incoming.get(name)
    if (value) {
      headers.set(name, value)
    }
  }
  return headers
}

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
