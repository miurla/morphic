import { cookies, headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

import { eq } from 'drizzle-orm'

import {
  getAuth,
  getSignUpMode,
  isBetterAuthSmtpConfigured
} from '@/lib/auth/better-auth/config'
import {
  consumeInvitation,
  validateInvitation
} from '@/lib/auth/better-auth/invitations'
import { user as authUser } from '@/lib/auth/better-auth/schema'
import { getRequestOrigin } from '@/lib/auth/request'
import type { AppUser, AuthActionResult, AuthProvider } from '@/lib/auth/types'
import { db } from '@/lib/db'

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

/**
 * Copy `set-cookie` headers produced by Better Auth API calls back into the
 * response cookies so the browser stores (or clears) the session cookie.
 */
async function applySetCookieHeaders(responseHeaders: Headers | undefined) {
  if (!responseHeaders) {
    return
  }
  const cookieStore = await cookies()
  for (const raw of responseHeaders.getSetCookie()) {
    const [pair, ...attributes] = raw.split(';')
    const separator = pair.indexOf('=')
    if (separator === -1) {
      continue
    }
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    const options: Record<string, string | number | boolean | Date> = {}
    for (const attribute of attributes) {
      const [rawName, rawValue] = attribute.trim().split('=')
      const key = rawName.toLowerCase()
      if (key === 'max-age') options.maxAge = Number(rawValue)
      else if (key === 'expires') options.expires = new Date(rawValue)
      else if (key === 'path') options.path = rawValue
      else if (key === 'domain') options.domain = rawValue
      else if (key === 'samesite')
        options.sameSite = rawValue.toLowerCase() as 'lax' | 'strict' | 'none'
      else if (key === 'secure') options.secure = true
      else if (key === 'httponly') options.httpOnly = true
    }
    cookieStore.set(name, value, options)
  }
}

interface BetterAuthSessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: Date
  role?: string | null
}

function toAppUser(user: BetterAuthSessionUser): AppUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    createdAt: user.createdAt ?? null,
    role: user.role ?? null
  }
}

export const betterAuthProvider: AuthProvider = {
  name: 'better-auth',

  get capabilities() {
    return {
      signUp: true,
      passwordReset: isBetterAuthSmtpConfigured(),
      deleteUser: true
    }
  },

  async getCurrentUser(): Promise<AppUser | null> {
    const session = await getAuth().api.getSession({
      headers: await headers()
    })
    if (!session) {
      return null
    }
    return toAppUser(session.user as BetterAuthSessionUser)
  },

  async handleSession(request: NextRequest): Promise<NextResponse> {
    const session = await getAuth().api.getSession({
      headers: request.headers
    })

    // Public paths that do not require a session (mirrors the supabase middleware)
    const publicPaths = ['/auth', '/share', '/api']
    const pathname = request.nextUrl.pathname

    if (
      !session &&
      pathname !== '/' &&
      !publicPaths.some(path => pathname.startsWith(path))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
  },

  async signIn({
    email,
    password
  }: {
    email: string
    password: string
  }): Promise<AuthActionResult> {
    try {
      const { headers: responseHeaders } = await getAuth().api.signInEmail({
        body: { email, password },
        headers: await headers(),
        returnHeaders: true
      })
      await applySetCookieHeaders(responseHeaders)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'Invalid email or password')
      }
    }
  },

  async signUp({
    email,
    password,
    token
  }: {
    email: string
    password: string
    token?: string
  }): Promise<AuthActionResult> {
    if (getSignUpMode() === 'invite') {
      const invitation = await validateInvitation(token)
      if (!invitation) {
        return {
          success: false,
          error: 'Sign-up requires a valid invitation token.'
        }
      }
      // Invitations issued for a specific address can only be redeemed by
      // that address, so a forwarded link is useless to anyone else. The
      // admin action always requires an email, so the truthy check is
      // defense-in-depth for rows that predate that requirement.
      // Checked before the claim so a mismatched attempt does not burn the
      // invitation for its intended recipient.
      if (
        invitation.email &&
        invitation.email.trim().toLowerCase() !== email.trim().toLowerCase()
      ) {
        return {
          success: false,
          error: 'This invitation was issued for a different email address.'
        }
      }
      // Claim the invitation before creating the account so concurrent
      // submissions of the same link cannot both pass validation. If the
      // sign-up then fails, the invitation stays consumed: safer than
      // allowing a second redemption.
      const claimed = await consumeInvitation(invitation.id)
      if (!claimed) {
        return {
          success: false,
          error: 'Sign-up requires a valid invitation token.'
        }
      }
    }

    try {
      const { response, headers: responseHeaders } =
        await getAuth().api.signUpEmail({
          body: { name: email, email, password },
          headers: await headers(),
          returnHeaders: true
        })
      await applySetCookieHeaders(responseHeaders)

      // signUpEmail resolves to `{ token, user }` — there is no `session`
      // field. The token is the session token the set-cookie headers above
      // already delivered to the browser, so its presence is the success
      // signal.
      if (!response || !(response as { token?: unknown }).token) {
        return {
          success: false,
          error: 'Sign-up failed. The account may already exist.'
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'An error occurred')
      }
    }
  },

  async signOut(): Promise<AuthActionResult> {
    try {
      const { headers: responseHeaders } = await getAuth().api.signOut({
        headers: await headers(),
        returnHeaders: true
      })
      await applySetCookieHeaders(responseHeaders)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'Failed to sign out')
      }
    }
  },

  async requestPasswordReset(email: string): Promise<AuthActionResult> {
    if (!isBetterAuthSmtpConfigured()) {
      return {
        success: false,
        error: 'Password reset is not configured on this instance.'
      }
    }

    try {
      const origin = await getRequestOrigin()
      await getAuth().api.requestPasswordReset({
        body: {
          email,
          redirectTo: `${origin}/auth/update-password`
        },
        headers: await headers()
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'Failed to send reset email')
      }
    }
  },

  async updatePassword(
    password: string,
    token?: string
  ): Promise<AuthActionResult> {
    try {
      await getAuth().api.resetPassword({
        body: {
          newPassword: password,
          ...(token ? { token } : {})
        },
        headers: await headers()
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'Failed to update password')
      }
    }
  },

  validateDeleteUserConfig(): string | null {
    return null
  },

  async deleteUser(userId: string): Promise<AuthActionResult> {
    try {
      // Cascades remove sessions and accounts via foreign keys
      await db.delete(authUser).where(eq(authUser.id, userId))
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'Failed to delete user')
      }
    }
  }
}
