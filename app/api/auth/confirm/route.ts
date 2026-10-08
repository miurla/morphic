import { type NextRequest, NextResponse } from 'next/server'

import { getAuthProvider } from '@/lib/auth/provider'

/**
 * Callback target for email action links (password recovery). Supabase
 * appends a one-time `code` to the reset link; exchanging it here persists
 * the recovery session as cookies before the update-password form runs.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const provider = getAuthProvider()

  if (!code || !provider.exchangeEmailActionCode) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const result = await provider.exchangeEmailActionCode(code)
  if (!result.success) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.redirect(new URL('/auth/update-password', request.url))
}
