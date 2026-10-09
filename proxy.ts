import { type NextRequest, NextResponse } from 'next/server'

import { getAuthProvider } from '@/lib/auth/provider'

/**
 * Headers forwarded to the PostHog relay destination: the incoming request
 * minus credentials. The /relay rewrite proxies to an external host and
 * forwards request headers with it, so the session cookie must be removed
 * here. PostHog authenticates through the project key in the payload,
 * not cookies.
 */
export function relayStrippedHeaders(source: Headers): Headers {
  const headers = new Headers(source)
  headers.delete('cookie')
  headers.delete('authorization')
  return headers
}

export async function proxy(request: NextRequest) {
  // Strip credentials from PostHog relay requests before the rewrite
  // proxies them off-box. Covers both auth providers because every
  // request funnels through here.
  if (request.nextUrl.pathname.startsWith('/relay')) {
    return NextResponse.next({
      request: { headers: relayStrippedHeaders(request.headers) }
    })
  }

  // Get the protocol from X-Forwarded-Proto header or request protocol
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol

  // Get the host from X-Forwarded-Host header or request host
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || ''

  // Construct the base URL - ensure protocol has :// format
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

  // Create a response via the active auth provider's session enforcement
  // (supabase refreshes/validates the session, none passes through)
  let response: NextResponse

  response = await getAuthProvider().handleSession(request)

  // Add request information to response headers
  response.headers.set('x-url', request.url)
  response.headers.set('x-host', host)
  response.headers.set('x-protocol', protocol)
  response.headers.set('x-base-url', baseUrl)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/favicon (source favicon images, which need no session)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
