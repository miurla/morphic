import { getAuth } from '@/lib/auth/better-auth/config'

// Better Auth's HTTP surface: server actions cover the server-side calls
// (sign-in/sign-up/session), but the OIDC flow needs real endpoints — the
// identity provider redirects the browser back to
// /api/auth/callback/<providerId>, where better-auth exchanges the code,
// links the account, sets the session cookie and redirects to the page the
// login form requested (see betterAuthProvider.signInWithOAuth).
//
// The auth instance is built lazily, per request: `next build` evaluates
// route modules to collect page data before any deployment environment is
// known, and getAuth() must not run then — it throws by design without
// BETTER_AUTH_SECRET, and the builder cannot reach the database.
const handle = (request: Request): Response | Promise<Response> =>
  getAuth().handler(request)

export async function GET(request: Request) {
  return handle(request)
}

// Sign-out and the credential sign-in endpoints are POSTs on the same handler.
export async function POST(request: Request) {
  return handle(request)
}
