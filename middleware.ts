import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Get the protocol from X-Forwarded-Proto header or request protocol
    const protocol =
      req.headers.get('x-forwarded-proto') || req.nextUrl.protocol

    // Get the host from X-Forwarded-Host header or request host
    const host =
      req.headers.get('x-forwarded-host') || req.headers.get('host') || ''

    // Construct the base URL - ensure protocol has :// format
    const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

    // Create a response
    const response = NextResponse.next()

    // Add request information to response headers
    response.headers.set('x-url', req.url)
    response.headers.set('x-host', host)
    response.headers.set('x-protocol', protocol)
    response.headers.set('x-base-url', baseUrl)

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Define public paths that don't require authentication
        const publicPaths = [
          '/', // Root path
          '/auth', // Auth-related pages
          '/share', // Share pages
          '/api/auth', // NextAuth API routes
          '/api/chat', // Allow chat API for public access
          '/api/advanced-search' // Allow search API
          // Add other public paths here if needed
        ]

        const pathname = req.nextUrl.pathname

        // Allow access to public paths
        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true
        }

        // Require authentication for all other paths
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
