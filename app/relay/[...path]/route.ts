import { type NextRequest } from 'next/server'

// Mirrors the destinations of the PostHog proxy rewrites this handler
// replaced.
const ASSET_SEGMENTS = new Set(['static', 'array'])

/**
 * Same-origin PostHog relay, implemented as a route handler instead of a
 * next.config rewrite so credentials are structurally never forwarded:
 * a rewrite proxies the incoming request headers (session cookie
 * included) to an external host, and keeping any middleware strip in
 * sync with the rewrite's path matching is a drift hazard. This handler
 * forwards only what PostHog needs and nothing else.
 */
async function relay(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params
  const host = ASSET_SEGMENTS.has(path[0])
    ? 'https://us-assets.i.posthog.com'
    : 'https://us.i.posthog.com'
  const target = new URL(`/${path.join('/')}`, host)
  target.search = request.nextUrl.search

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }
  // Cookie and Authorization are deliberately not forwarded: session
  // credentials must never reach the analytics provider.

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer()

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body
  })

  const responseHeaders = new Headers()
  const upstreamContentType = upstream.headers.get('content-type')
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType)
  }
  const cacheControl = upstream.headers.get('cache-control')
  if (cacheControl) {
    responseHeaders.set('cache-control', cacheControl)
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  })
}

export { relay as GET, relay as POST }
