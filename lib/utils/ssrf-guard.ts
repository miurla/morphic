/**
 * SSRF (Server-Side Request Forgery) guard for user-controlled URL fetching.
 *
 * Provides `safeFetch()` which wraps the native `fetch()` with:
 * - Scheme validation (HTTP/HTTPS only)
 * - DNS resolution with private IP blocking across IPv4 and IPv6
 * - Blocked hostname detection (localhost, metadata, k8s, etc.)
 * - Manual redirect handling with re-validation at each hop
 * - Response size capping
 * - Structured logging for blocked attempts
 */

import dns from 'node:dns'
import { isIP, isIPv4, isIPv6 } from 'node:net'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_REDIRECTS = parseInt(
  process.env.SSRF_MAX_REDIRECTS ?? '5',
  10
)
const MAX_RESPONSE_BYTES = parseInt(
  process.env.SSRF_MAX_RESPONSE_BYTES ?? '10485760', // 10 MB
  10
)

const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.intranet$/i,
  /\.corp$/i,
  /\.lan$/i,
  /^metadata\.google\.internal$/i,
  /^instance-data$/i,
  /\.svc\.cluster\.local$/i,
  /^169\.254\.169\.254$/i
]

// Parse additional blocked hostnames from environment
const envBlockedHostnames = (process.env.SSRF_BLOCKED_HOSTNAMES ?? '')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean)

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

export class SSRFError extends Error {
  public readonly url: string
  public readonly reason: string

  constructor(url: string, reason: string) {
    super(`SSRF blocked: ${reason}`)
    this.name = 'SSRFError'
    this.url = url
    this.reason = reason
  }
}

/**
 * Parse and validate a URL string. Only `http:` and `https:` schemes are
 * allowed. Credentials embedded in the URL are rejected.
 */
export function validateUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new SSRFError(raw, 'Invalid URL')
  }

  // Block non-HTTP(S) schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SSRFError(raw, `Blocked scheme: ${parsed.protocol}`)
  }

  // Block embedded credentials
  if (parsed.username || parsed.password) {
    throw new SSRFError(raw, 'URLs with embedded credentials are not allowed')
  }

  return parsed
}

// ---------------------------------------------------------------------------
// IP range checks
// ---------------------------------------------------------------------------

/**
 * Parse an IPv4 address into a 32-bit number for range comparison.
 * Returns `null` for non-IPv4 strings.
 */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let num = 0
  for (const part of parts) {
    const octet = parseInt(part, 10)
    if (isNaN(octet) || octet < 0 || octet > 255) return null
    num = (num << 8) | octet
  }
  return num >>> 0 // Ensure unsigned 32-bit
}

/**
 * Check if an IPv4 address falls within a CIDR range.
 */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  const ipNum = ipv4ToNumber(ip)
  const baseNum = ipv4ToNumber(base)
  if (ipNum === null || baseNum === null) return false

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipNum & mask) === (baseNum & mask)
}

/** Blocked IPv4 CIDR ranges. */
const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8', // Current network
  '10.0.0.0/8', // RFC 1918 private
  '100.64.0.0/10', // CGN / shared address space
  '127.0.0.0/8', // Loopback
  '169.254.0.0/16', // Link-local (AWS/GCP/Azure metadata)
  '172.16.0.0/12', // RFC 1918 private
  '192.0.0.0/24', // IETF protocol assignments
  '192.0.2.0/24', // TEST-NET-1
  '192.168.0.0/16', // RFC 1918 private
  '198.18.0.0/15', // Benchmark testing
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // Multicast
  '240.0.0.0/4' // Reserved / broadcast
]

/** Blocked IPv6 prefixes (checked via startsWith after normalization). */
const BLOCKED_IPV6 = [
  '::1', // Loopback
  '::', // Unspecified
  '::ffff:127.', // IPv4-mapped loopback
  '::ffff:10.', // IPv4-mapped private
  '::ffff:172.16.', '::ffff:172.17.', '::ffff:172.18.', '::ffff:172.19.',
  '::ffff:172.20.', '::ffff:172.21.', '::ffff:172.22.', '::ffff:172.23.',
  '::ffff:172.24.', '::ffff:172.25.', '::ffff:172.26.', '::ffff:172.27.',
  '::ffff:172.28.', '::ffff:172.29.', '::ffff:172.30.', '::ffff:172.31.',
  '::ffff:192.168.', // IPv4-mapped private
  '::ffff:169.254.', // IPv4-mapped link-local
  '::ffff:0.', // IPv4-mapped current network
  '::ffff:100.64.', '::ffff:100.65.', '::ffff:100.66.', '::ffff:100.67.',
  'fe80:', // Link-local unicast
  'fc00:', // Unique local (ULA)
  'fd' // Unique local (ULA) fd00::/8
]

/**
 * Returns `true` if the given IP address (v4 or v6) resolves to a
 * private, loopback, link-local, multicast, or otherwise blocked range.
 */
export function isPrivateIP(ip: string): boolean {
  // Unwrap IPv6-mapped IPv4 (e.g. "::ffff:192.168.1.1")
  const mappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  const effectiveIp = mappedMatch ? mappedMatch[1] : ip

  if (isIPv4(effectiveIp) || isIP(effectiveIp) === 4) {
    return BLOCKED_IPV4_CIDRS.some(cidr => ipv4InCidr(effectiveIp, cidr))
  }

  if (isIPv6(ip) || isIP(ip) === 6) {
    const normalized = ip.toLowerCase()
    return BLOCKED_IPV6.some(prefix => normalized.startsWith(prefix))
  }

  // If we can't determine IP version, block it to be safe
  return true
}

// ---------------------------------------------------------------------------
// Hostname checks
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the hostname matches a known internal/metadata pattern.
 */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()

  // Check environment-configured blocked hostnames
  if (envBlockedHostnames.includes(lower)) return true

  // Check against built-in patterns
  return BLOCKED_HOSTNAME_PATTERNS.some(pattern => pattern.test(lower))
}

// ---------------------------------------------------------------------------
// DNS resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a hostname via DNS and verify that all returned addresses are in
 * public (non-blocked) IP ranges. We validate every address family returned
 * by the resolver so a public A record cannot hide a blocked AAAA record.
 */
export async function resolveAndValidateHost(
  hostname: string,
  originalUrl: string
): Promise<void> {
  // If the hostname is already an IP literal, check it directly
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new SSRFError(originalUrl, `Blocked IP: ${hostname}`)
    }
    return
  }

  let results: Array<{ address: string }>
  try {
    results = await dns.promises.lookup(hostname, {
      all: true,
      verbatim: true
    })
  } catch {
    // DNS resolution failure — let the fetch itself fail naturally.
    return
  }

  for (const { address } of results) {
    if (isPrivateIP(address)) {
      throw new SSRFError(
        originalUrl,
        `DNS resolved to blocked IP: ${hostname} → ${address}`
      )
    }
  }
}

/**
 * Validate a user-controlled URL before any local fetch or third-party
 * extraction handoff. This performs scheme, credential, hostname, and DNS
 * checks but does not make an HTTP request.
 */
export async function validateOutboundUrl(url: string): Promise<URL> {
  const parsed = validateUrl(url)

  if (isBlockedHostname(parsed.hostname)) {
    logBlockedAttempt(url, `Blocked hostname: ${parsed.hostname}`)
    throw new SSRFError(url, `Blocked hostname: ${parsed.hostname}`)
  }

  await resolveAndValidateHost(parsed.hostname, url)
  return parsed
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log a blocked SSRF attempt. Sanitizes the URL to avoid leaking secrets
 * in query parameters.
 */
export function logBlockedAttempt(url: string, reason: string): void {
  let sanitized: string
  try {
    const parsed = new URL(url)
    // Strip query params and fragment to avoid logging secrets
    sanitized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    sanitized = url.substring(0, 200)
  }

  console.warn(`[SSRF-BLOCKED] url=${sanitized} reason="${reason}"`)
}

// ---------------------------------------------------------------------------
// Response size limiter
// ---------------------------------------------------------------------------

/**
 * Read a Response body with a size cap. Aborts if the body exceeds
 * `maxBytes`. Returns the body as a string.
 */
export async function readResponseWithLimit(
  response: Response,
  maxBytes: number = MAX_RESPONSE_BYTES
): Promise<string> {
  // Check Content-Length header first for an early rejection
  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new SSRFError(
      response.url,
      `Response too large: ${contentLength} bytes (limit: ${maxBytes})`
    )
  }

  const reader = response.body?.getReader()
  if (!reader) {
    return await response.text()
  }

  const decoder = new TextDecoder()
  const chunks: string[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        reader.cancel()
        throw new SSRFError(
          response.url,
          `Response exceeded size limit: ${totalBytes}+ bytes (limit: ${maxBytes})`
        )
      }

      chunks.push(decoder.decode(value, { stream: true }))
    }
    // Flush the decoder
    chunks.push(decoder.decode())
  } catch (error) {
    if (error instanceof SSRFError) throw error
    throw error
  }

  return chunks.join('')
}

// ---------------------------------------------------------------------------
// Safe fetch
// ---------------------------------------------------------------------------

export interface SafeFetchOptions {
  /** Maximum number of redirects to follow. Defaults to SSRF_MAX_REDIRECTS. */
  maxRedirects?: number
  /** Maximum response body size in bytes. Defaults to SSRF_MAX_RESPONSE_BYTES. */
  maxResponseBytes?: number
}

/**
 * Fetch a URL with full SSRF protection:
 *
 * 1. Validate the URL scheme (HTTP/HTTPS only) and reject credentials
 * 2. Check the hostname against the blocked list
 * 3. Resolve DNS and verify all IPs are in public ranges
 * 4. Follow redirects manually, re-validating each hop
 * 5. Cap response size
 *
 * Returns a standard `Response` object. The body has NOT been consumed —
 * use `readResponseWithLimit()` to safely read it, or consume it yourself
 * if you have your own size handling.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit & SafeFetchOptions
): Promise<Response> {
  const maxRedirects = init?.maxRedirects ?? MAX_REDIRECTS
  const {
    maxRedirects: _mr,
    maxResponseBytes: _mrb,
    ...fetchInit
  } = (init ?? {}) as RequestInit & SafeFetchOptions

  let currentUrl = url
  let redirectCount = 0

  while (true) {
    // 1-3. Validate URL, hostname, and DNS before every request/redirect hop.
    await validateOutboundUrl(currentUrl)

    // 4. Fetch with manual redirect handling
    const response = await fetch(currentUrl, {
      ...fetchInit,
      redirect: 'manual'
    })

    // Handle redirects
    const status = response.status
    if (status >= 300 && status < 400) {
      redirectCount++
      if (redirectCount > maxRedirects) {
        logBlockedAttempt(
          currentUrl,
          `Too many redirects (${redirectCount}/${maxRedirects})`
        )
        throw new SSRFError(
          currentUrl,
          `Too many redirects (max: ${maxRedirects})`
        )
      }

      const location = response.headers.get('location')
      if (!location) {
        throw new SSRFError(currentUrl, 'Redirect without Location header')
      }

      // Resolve relative redirects
      try {
        currentUrl = new URL(location, currentUrl).toString()
      } catch {
        throw new SSRFError(
          currentUrl,
          `Invalid redirect location: ${location}`
        )
      }

      // Loop back to re-validate the new URL
      continue
    }

    return response
  }
}
