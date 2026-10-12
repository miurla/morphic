import { type NextRequest, NextResponse } from 'next/server'

import {
  exceedsRelayBodyCap,
  RELAY_PREFIX,
  relayRequestHeaders,
  relayTarget
} from '@/lib/analytics/relay-target'
import { getAuthProvider, resolveAuthProviderName } from '@/lib/auth/provider'

// Better Auth sends /relay through the route handler. Other providers
// proxy straight to PostHog so analytics requests cost no function
// invocation and keep upstream caching.
function relayRewrite(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl
  if (pathname !== RELAY_PREFIX && !pathname.startsWith(`${RELAY_PREFIX}/`)) {
    return null
  }
  if (resolveAuthProviderName() === 'better-auth') {
    return null
  }
  const target = relayTarget(pathname.slice(RELAY_PREFIX.length) || '/', search)
  if (!target) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (exceedsRelayBodyCap(request.headers)) {
    return new NextResponse('Payload too large', { status: 413 })
  }
  return NextResponse.rewrite(target, {
    request: { headers: relayRequestHeaders(request.headers) }
  })
}

export async function proxy(request: NextRequest) {
  const relay = relayRewrite(request)
  if (relay) {
    return relay
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
