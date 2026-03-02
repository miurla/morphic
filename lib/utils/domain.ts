/**
 * Extract display name from URL by removing TLD and www/subdomain
 * This is a pure client-safe utility function without Next.js dependencies
 * @param url - Full URL string
 * @returns Domain name without TLD (e.g., "google" from "www.google.com")
 * @example
 * displayUrlName("https://www.google.com") // "google"
 * displayUrlName("https://docs.github.com") // "github"
 * displayUrlName("https://en.wikipedia.org") // "wikipedia"
 */
export const displayUrlName = (url: string): string => {
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.split('.')

    // For hostnames like "www.google.com" or "docs.github.com"
    // Extract the main domain name (second-to-last part)
    // parts.length > 2: ["www", "google", "com"] -> "google"
    // parts.length <= 2: ["localhost"] or ["example", "com"] -> "example"
    return parts.length > 2 ? parts.slice(1, -1).join('.') : parts[0]
  } catch {
    // Fallback for invalid URLs
    return 'source'
  }
}
