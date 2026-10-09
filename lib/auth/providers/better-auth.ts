import { cookies, headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

import { eq } from 'drizzle-orm'

import {
  getAuth,
  getEmailLinkOrigin,
  getSignUpMode,
  isBetterAuthSmtpConfigured,
  isBootstrapAccount
} from '@/lib/auth/better-auth/config'
import {
  consumeInvitation,
  createInvitation,
  hasRecentBootstrapInvitation,
  revokeInvitation,
  validateInvitation
} from '@/lib/auth/better-auth/invitations'
import { sendSmtpMail } from '@/lib/auth/better-auth/mailer'
import { user as authUser } from '@/lib/auth/better-auth/schema'
import { getRequestOrigin } from '@/lib/auth/request'
import type { AppUser, AuthActionResult, AuthProvider } from '@/lib/auth/types'
import { db } from '@/lib/db'

/**
 * Minimum gap between bootstrap invitation emails for the same address.
 * The bootstrap branch runs before better-auth's rate limiter, so this
 * is the only throttle on repeated tokenless sign-up attempts.
 */
const BOOTSTRAP_INVITE_COOLDOWN_MS = 15 * 60 * 1000

/**
 * Serializes the bootstrap cooldown check + invitation creation + send per
 * address. The check and the insert are separate queries, so concurrent
 * tokenless sign-ups for the gated address could all pass the check before
 * the first insert landed and each mail a live admin link. Morphic runs as
 * a single instance, so an in-process chain per address is sufficient.
 */
const bootstrapSendLocks = new Map<string, Promise<unknown>>()

async function withBootstrapSendLock<T>(
  emailKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const previous = bootstrapSendLocks.get(emailKey) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const entry = previous.then(
    () => gate,
    () => gate
  )
  bootstrapSendLocks.set(emailKey, entry)
  await previous.catch(() => {})
  try {
    return await fn()
  } finally {
    release()
    if (bootstrapSendLocks.get(emailKey) === entry) {
      bootstrapSendLocks.delete(emailKey)
    }
  }
}

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
      passwordReset:
        isBetterAuthSmtpConfigured() && getEmailLinkOrigin() !== '',
      deleteUser: true,
      // Email/password only: no OAuth provider is wired into the local
      // instance, and accounts are usable immediately without email
      // confirmation.
      oauth: false,
      emailVerification: false
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
    const { response: session, headers: responseHeaders } =
      await getAuth().api.getSession({
        headers: request.headers,
        returnHeaders: true
      })

    // Public paths that do not require a session (mirrors the supabase
    // middleware). /relay is the PostHog reverse proxy: analytics requests
    // from the login and sign-up pages must not bounce to /auth/login.
    // /search hosts the shared-chat pages: app/search/[id]/page.tsx decides
    // visibility (public chats are viewable logged out, private ones are
    // rejected there), so the proxy must not pre-empt that check.
    const publicPaths = ['/auth', '/share', '/api', '/relay', '/search']
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

    const response = NextResponse.next({ request })
    // better-auth refreshes the session cookie once a session passes half
    // its lifetime (updateAge). Forward the refreshed cookie so active
    // sessions do not expire at the original expiry time.
    if (responseHeaders) {
      for (const raw of responseHeaders.getSetCookie()) {
        response.headers.append('set-cookie', raw)
      }
    }
    return response
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
    // The bootstrap account is the seed admin of a fresh instance:
    // invitations can only be created by an existing admin, so the gated
    // address must be able to sign up without a token.
    const bootstrapAccount = await isBootstrapAccount(email)
    if (bootstrapAccount && isBetterAuthSmtpConfigured()) {
      const origin = getEmailLinkOrigin()
      if (!origin) {
        // Fail closed: without a canonical origin the confirmation link
        // cannot be delivered safely, and silently falling back to
        // first-come sign-up would let anyone who guesses the address
        // claim admin while the operator believes mailbox proof is active.
        return {
          success: false,
          error:
            'Bootstrap sign-up requires BETTER_AUTH_URL to deliver its confirmation email. Set it, or unset SMTP to accept the first sign-up directly.'
        }
      }
      // The bootstrap gate only compares caller-supplied email text, so on
      // an instance reachable by others anyone who guesses the operator's
      // address could claim the admin role. When SMTP is available, require
      // proof of mailbox control instead: without a token, send a one-time
      // invitation bound to the address; with one, it must be that very
      // invitation. Validated in every sign-up mode — open mode otherwise
      // ignores tokens, which would let any non-empty token skip the proof.
      if (!token) {
        const emailKey = email.trim().toLowerCase()
        return withBootstrapSendLock(emailKey, async () => {
          try {
            if (
              await hasRecentBootstrapInvitation(
                emailKey,
                BOOTSTRAP_INVITE_COOLDOWN_MS
              )
            ) {
              // A live link is already on its way: this branch runs before
              // better-auth's rate limiter, so do not spam the mailbox.
              return {
                success: true,
                notice: `A bootstrap link was sent to ${email}. Open it to finish creating the admin account.`
              }
            }
            const { invitation, token: inviteToken } = await createInvitation({
              invitedBy: 'bootstrap',
              email: emailKey
            })
            try {
              await sendSmtpMail({
                to: email,
                subject: 'Finish creating your Morphic admin account',
                text: `Use this link to finish creating the admin account for ${email} (valid for one week): ${origin}/auth/sign-up?token=${inviteToken}`,
                html: `<p>Use this link to finish creating the admin account for ${email} (valid for one week):</p><p><a href="${origin}/auth/sign-up?token=${inviteToken}">Complete sign-up</a></p>`
              })
            } catch (error) {
              // Delivery failed: release the invitation so a retry can send
              // a fresh link instead of being locked out by the cooldown.
              await revokeInvitation(invitation.id).catch(() => {})
              throw error
            }
            return {
              success: true,
              notice: `A bootstrap link was sent to ${email}. Open it to finish creating the admin account.`
            }
          } catch (error) {
            return {
              success: false,
              error: errorMessage(error, 'Could not send the bootstrap email.')
            }
          }
        })
      }
      const invitation = await validateInvitation(token)
      if (
        !invitation ||
        !invitation.email ||
        invitation.email.trim().toLowerCase() !== email.trim().toLowerCase()
      ) {
        return {
          success: false,
          error:
            'Bootstrap sign-up requires the link sent to your email address.'
        }
      }
      const claimed = await consumeInvitation(invitation.id)
      if (!claimed) {
        return {
          success: false,
          error: 'This bootstrap link has already been used.'
        }
      }
    } else if (getSignUpMode() === 'invite' && !bootstrapAccount) {
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
      // A token reset changes the credential only: no session cookie is
      // issued, so send the user to sign in with the new password instead
      // of landing logged-out on the app root.
      return token
        ? { success: true, redirectTo: '/auth/login' }
        : { success: true }
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
