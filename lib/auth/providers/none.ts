import { type NextRequest, NextResponse } from 'next/server'

import type { AppUser, AuthProvider } from '@/lib/auth/types'

export const DEFAULT_ANONYMOUS_USER_ID = 'anonymous-user'

/**
 * Anonymous mode (`ENABLE_AUTH=false`): all users share one configured user
 * ID. Preserves the previous skip-authentication behavior, including the
 * Morphic Cloud guard and the startup warning.
 */
export const noneAuthProvider: AuthProvider = {
  name: 'none',
  capabilities: {
    signUp: false,
    passwordReset: false,
    deleteUser: false,
    oauth: false,
    emailVerification: false
  },

  async getCurrentUser(): Promise<AppUser | null> {
    return null
  },

  async getCurrentUserId(): Promise<string | undefined> {
    // Guard: Prevent disabling auth in Morphic Cloud deployments
    if (process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true') {
      throw new Error(
        'ENABLE_AUTH=false is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
      )
    }

    // Always warn when authentication is disabled (except in tests)
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '⚠️  Authentication disabled. Running in anonymous mode.\n' +
          '   All users share the same user ID. For personal use only.'
      )
    }

    return process.env.ANONYMOUS_USER_ID || DEFAULT_ANONYMOUS_USER_ID
  },

  async handleSession(request: NextRequest): Promise<NextResponse> {
    // Anonymous mode enforces no redirects
    return NextResponse.next({ request })
  }
}
