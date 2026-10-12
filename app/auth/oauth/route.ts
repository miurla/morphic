import { NextRequest, NextResponse } from 'next/server'

// The client you created from the Server-Side Auth instructions
import { safeRedirectPath } from '@/lib/auth/redirect-target'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL (same-origin paths
  // only, so a crafted ?next= cannot bounce the signed-in user off-site).
  // The login form carries the destination in a short-lived cookie because
  // Supabase's redirect allowlist matches the callback URL exactly and
  // would reject a query-string variant of it.
  const next = safeRedirectPath(
    searchParams.get('next') ??
      request.cookies.get('auth_next')?.value ??
      undefined
  )

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const target = isLocalEnv
        ? `${origin}${next}`
        : forwardedHost
          ? `https://${forwardedHost}${next}`
          : `${origin}${next}`
      const response = NextResponse.redirect(target)
      response.cookies.delete('auth_next')
      return response
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`)
}
