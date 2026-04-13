import crypto from 'crypto'

/**
 * Generate a Gravatar URL from an email address (server-side, synchronous).
 * Uses Node.js crypto for SHA-256 hashing.
 */
export function getGravatarUrl(email: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?d=404`
}
