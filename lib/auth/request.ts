import { headers } from 'next/headers'

/**
 * Best-effort origin of the current request, usable from server actions and
 * route handlers for building absolute redirect URLs.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const origin = headerStore.get('origin')
  if (origin) {
    return origin
  }
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https'
  return host ? `${protocol}://${host}` : ''
}
