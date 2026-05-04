/**
 * Generate a unique ID for database records.
 * Uses the Web Crypto API (available in Node.js 14.17+ and all modern browsers).
 */
export function generateId(): string {
  return crypto.randomUUID()
}
