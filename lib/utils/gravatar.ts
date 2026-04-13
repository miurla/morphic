/**
 * Generate a Gravatar URL from an email address.
 * Uses SHA-256 hashing via Web Crypto API (async, for client-side use).
 * Returns the URL with `d=404` so that a 404 is returned for unregistered emails,
 * allowing the UI to fall back to initials or a placeholder icon.
 */
export async function getGravatarUrl(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized)
  )
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `https://www.gravatar.com/avatar/${hashHex}?d=404`
}
