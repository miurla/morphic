import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Create a response
  const response = NextResponse.next()

  // Get the protocol from X-Forwarded-Proto header or request protocol
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol

  // Get the host from X-Forwarded-Host header or request host
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || ''

  // Construct the base URL - ensure protocol has :// format
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

  // Add request information to response headers
  response.headers.set('x-url', request.url)
  response.headers.set('x-host', host)
  response.headers.set('x-protocol', protocol)
  response.headers.set('x-base-url', baseUrl)

  return response
}
