import { getAuth } from '@/lib/auth/better-auth/config'

// Better Auth's HTTP surface, restricted to the provider callback flow.
//
// Why not the full handler: mounting Better Auth's catch-all would expose
// POST /api/auth/sign-up/email directly, bypassing the invitation and
// bootstrap-account policy that betterAuthProvider.signUp enforces — an
// invite-only instance would accept anyone. The credential endpoints are
// therefore driven exclusively through server actions (lib/actions/auth.ts
// dispatches to the provider implementations), and the only HTTP surface a
// third party needs is where the identity provider redirects the browser:
//
// - GET /api/auth/callback/<providerId>: the authorization response, where
//   Better Auth exchanges the code, links the account, sets the session
//   cookie and redirects to the page the login form requested.
// - GET /api/auth/error: Better Auth's target when a callback fails
//   (e.g. an invite-only instance rejecting an unregistered identity).
//
// The auth instance is built lazily, per request: `next build` evaluates
// route modules to collect page data before any deployment environment is
// known, and getAuth() must not run then — it throws by design without
// BETTER_AUTH_SECRET, and the builder cannot reach the database.

const CALLBACK_PATHNAME = /^\/api\/auth\/callback\/[A-Za-z0-9_.:$-]{1,128}$/

function isCallbackRequest(pathname: string, method: string): boolean {
  return (
    method === 'GET' &&
    (CALLBACK_PATHNAME.test(pathname) || pathname === '/api/auth/error')
  )
}

async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (!isCallbackRequest(pathname, request.method)) {
    return new Response(
      'Not found. This deployment exposes only the provider callback ' +
        '(GET /api/auth/callback/<providerId>); authentication is driven ' +
        'through server actions.',
      { status: 404 }
    )
  }
  return getAuth().handler(request)
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
