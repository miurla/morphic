import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Create a response
  const response = NextResponse.next()

  // Add request information to response headers
  response.headers.set('x-url', request.url)
  response.headers.set('x-host', request.headers.get('host') || '')
  response.headers.set('x-protocol', request.nextUrl.protocol)

  return response
}
