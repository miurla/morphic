// Second-level labels used in compound TLDs (e.g. "com" in "com.au", "co" in "co.uk").
// When preceded by these and followed by a 2-letter country code, the last two
// labels are treated as a single TLD unit.
const COMPOUND_TLD_SECOND_LEVELS = new Set([
  'com',
  'co',
  'org',
  'net',
  'gov',
  'edu',
  'ac',
  'or',
  'ne',
  'go',
  'gob',
  'gouv',
  'mil',
  'sch',
  'ltd',
  'plc',
  'me',
  'nic'
])

/**
 * Extract display name from URL by removing TLD and www/subdomain
 * This is a pure client-safe utility function without Next.js dependencies
 * @param url - Full URL string
 * @returns Domain name without TLD (e.g., "google" from "www.google.com")
 * @example
 * displayUrlName("https://www.google.com") // "google"
 * displayUrlName("https://docs.github.com") // "github"
 * displayUrlName("https://en.wikipedia.org") // "wikipedia"
 * displayUrlName("https://www.saudiauto.com.sa") // "saudiauto"
 * displayUrlName("https://example.co.uk") // "example"
 */
export const displayUrlName = (url: string): string => {
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.split('.')

    // Detect compound TLDs like "com.au" / "co.uk" so the country code and its
    // second-level label are dropped together rather than leaving "saudiauto.com".
    const lastPart = parts[parts.length - 1]
    const secondToLast = parts[parts.length - 2]
    const hasCompoundTld =
      parts.length >= 3 &&
      lastPart.length === 2 &&
      COMPOUND_TLD_SECOND_LEVELS.has(secondToLast)
    // Single-label hosts (e.g. "localhost") have no TLD to strip.
    const tldLength = parts.length < 2 ? 0 : hasCompoundTld ? 2 : 1

    // Labels remaining after stripping the TLD (subdomains + registrable name).
    const nonTld = parts.slice(0, parts.length - tldLength)

    // Drop the leading subdomain (www, docs, en, ...) when present.
    // ["www", "google"] -> "google", ["sub", "domain", "example"] -> "domain.example"
    // ["example"] -> "example", ["localhost"] -> "localhost"
    return nonTld.length > 1 ? nonTld.slice(1).join('.') : nonTld[0]
  } catch {
    // Fallback for invalid URLs
    return 'source'
  }
}
