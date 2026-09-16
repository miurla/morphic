export const FAVICON_SIZES = [16, 32, 128] as const

export type FaviconSize = (typeof FAVICON_SIZES)[number]

// Matches what the upstream provider serves when no size is requested.
export const DEFAULT_FAVICON_SIZE: FaviconSize = 16

const MAX_HOSTNAME_LENGTH = 253
const HOSTNAME_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/

/**
 * Reduces a URL or a bare host to the hostname the favicon lookup uses, or
 * null when the input is not a public-looking name. IP literals are refused
 * here so the route never turns a rendered result into an address probe.
 */
export function normalizeFaviconDomain(source: string): string | null {
  const trimmed = source.trim()
  if (!trimmed || trimmed.length > 2048) return null

  let hostname: string
  try {
    const parsed = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    hostname = parsed.hostname.toLowerCase()
  } catch {
    return null
  }

  if (hostname.startsWith('[')) return null
  if (hostname.length > MAX_HOSTNAME_LENGTH) return null
  if (/^[\d.]+$/.test(hostname)) return null
  if (!HOSTNAME_PATTERN.test(hostname)) return null

  return hostname
}

export function isFaviconSize(value: number): value is FaviconSize {
  return (FAVICON_SIZES as readonly number[]).includes(value)
}

/**
 * Same-origin favicon URL. The icon is fetched by the server, so the visitor's
 * browser never tells a third party which sources a result cites.
 */
export function faviconUrl(
  source: string,
  size: FaviconSize = DEFAULT_FAVICON_SIZE
): string {
  const domain = normalizeFaviconDomain(source)
  if (!domain) return ''
  return `/api/favicon?domain=${encodeURIComponent(domain)}&sz=${size}`
}
