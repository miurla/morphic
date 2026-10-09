import { cookies, headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

import { count, eq } from 'drizzle-orm'

import {
  getAuth,
  getEmailLinkOrigin,
  getSignUpMode,
  isBetterAuthSmtpConfigured,
  isBootstrapAccount,
  reElectBootstrapAdmin
} from '@/lib/auth/better-auth/config'
import {
  consumeInvitation,
  createInvitation,
  hasRecentBootstrapInvitation,
  releaseInvitation,
  revokeInvitation,
  validateInvitation
} from '@/lib/auth/better-auth/invitations'
import { sendSmtpMail } from '@/lib/auth/better-auth/mailer'
import { user as authUser } from '@/lib/auth/better-auth/schema'
import { getRequestOrigin } from '@/lib/auth/request'
import type {
  AppUser,
  AuthActionResult,
  AuthProvider,
  AuthTransaction,
  DeletionGuardResult
} from '@/lib/auth/types'
import { db } from '@/lib/db'

/**
 * Whether an account already exists for the address. Used to decide whether
 * an uncertain sign-up failure (a throw after better-auth may have already
 * committed the user) may safely release the invitation claim.
 */
async function accountExists(email: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email))
      .limit(1)
    return Boolean(row)
  } catch {
    // Uncertain: prefer leaving the claim consumed over re-enabling a link
    // that may already have been redeemed.
    return true
  }
}

const LAST_ADMIN_ERROR =
  'You are the only admin. Promote another member to admin before deleting this account.'

/**
 * The last-admin invariant, evaluated against db (unlocked UX gate) or a
 * transaction (authoritative check). When lock is set the admin listing
 * uses SELECT ... FOR UPDATE, so concurrent deletions serialize on the
 * admin rows until the owning transaction commits. A concurrent sign-up
 * inserts a new row, which does not conflict with the admin-row locks,
 * so its insert can commit just after the user count below; the
 * post-commit re-election (postDeletion) covers that case.
 */
async function deletionGuard(
  q: Pick<typeof db, 'select' | 'delete'>,
  userId: string,
  lock: boolean
): Promise<DeletionGuardResult> {
  // The target row is locked before its role is read: a concurrent
  // promotion must not let a soon-to-be-admin slip past the last-admin
  // guard while its own deletion is already in flight. Members take the
  // same lock as admins so any two deletions serialize on the targets.
  const targetQuery = q
    .select({ role: authUser.role })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1)
  const [target] = lock ? await targetQuery.for('update') : await targetQuery
  const wasAdmin = target?.role === 'admin'
  if (!wasAdmin) {
    return { error: null, wasAdmin: false }
  }
  const adminsQuery = q
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.role, 'admin'))
  const admins = lock ? await adminsQuery.for('update') : await adminsQuery
  if (admins.length > 1) {
    return { error: null, wasAdmin }
  }
  // Last admin: deletion is only refused while other users remain.
  // Members left without an admin have no in-product path back, but an
  // empty user table is the documented re-bootstrap state, so the sole
  // account of a single-user instance must be able to delete itself.
  const [userCount] = await q.select({ n: count() }).from(authUser)
  if ((userCount?.n ?? 0) <= 1) {
    return { error: null, wasAdmin }
  }
  return { error: LAST_ADMIN_ERROR, wasAdmin }
}

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
      emailVerification: false,
      share: true
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
      // Drop the original query from the login URL itself; it travels
      // inside `next` (including its query string) instead. The login
      // form validates it with safeRedirectPath before following it.
      url.search = ''
      url.searchParams.set('next', pathname + request.nextUrl.search)
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
    // Set when an invitation claim succeeded, so a failed account creation
    // can release the claim and let the same link be retried.
    let consumedInvitationId: string | undefined
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
      consumedInvitationId = invitation.id
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
      // sign-up then fails before the account exists, the claim is released
      // below so the same link can be retried with a corrected password.
      const claimed = await consumeInvitation(invitation.id)
      if (!claimed) {
        return {
          success: false,
          error: 'Sign-up requires a valid invitation token.'
        }
      }
      consumedInvitationId = invitation.id
    }

    try {
      const { response, headers: responseHeaders } =
        await getAuth().api.signUpEmail({
          body: { name: email, email, password },
          headers: await headers(),
          returnHeaders: true
        })

      // signUpEmail resolves to `{ token, user }` — there is no `session`
      // field. The token is the session token the set-cookie headers below
      // deliver to the browser, so its presence is the success signal.
      if (!response || !(response as { token?: unknown }).token) {
        // A structured rejection: no account was created, so the claim is
        // released and the same link can be retried (e.g. with a password
        // that passes better-auth's rules).
        if (consumedInvitationId) {
          await releaseInvitation(consumedInvitationId).catch(() => {})
        }
        return {
          success: false,
          error: 'Sign-up failed. The account may already exist.'
        }
      }

      try {
        await applySetCookieHeaders(responseHeaders)
      } catch {
        // The account exists at this point: releasing the claim now would
        // re-enable a link whose address is taken. Report the failure
        // without touching the invitation.
        return {
          success: false,
          error:
            'Account created, but the sign-in could not be completed. Sign in with your new password.'
        }
      }

      return { success: true }
    } catch (error) {
      // Uncertain outcome: better-auth may have committed the user before
      // the connection failed. Only release the claim when no account
      // exists for the address.
      if (consumedInvitationId && !(await accountExists(email))) {
        await releaseInvitation(consumedInvitationId).catch(() => {})
      }
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

  async canDeleteUser(userId: string): Promise<string | null> {
    // Best-effort UX gate: callers run this before destructive side
    // effects. validateDeletion is the authoritative locked check.
    const { error } = await deletionGuard(db, userId, false)
    return error
  },

  async validateDeletion(
    userId: string,
    tx: AuthTransaction
  ): Promise<DeletionGuardResult> {
    // Runs inside the caller's transaction: FOR UPDATE on the admin rows
    // serializes concurrent admin deletions until that transaction
    // commits, so the answer cannot flip before the identity delete that
    // consumes this result.
    return deletionGuard(tx, userId, true)
  },

  async postDeletion(wasAdmin: boolean): Promise<void> {
    if (wasAdmin) {
      // Completes the bootstrap election for a sign-up whose own claim
      // declined because the admin row still existed when it ran (see
      // reElectBootstrapAdmin).
      await reElectBootstrapAdmin()
    }
  },

  async deleteUser(
    userId: string,
    tx?: AuthTransaction
  ): Promise<AuthActionResult> {
    try {
      if (tx) {
        // Runs inside the caller's transaction; the caller validated the
        // guard under this transaction's locks before any cleanup.
        await tx.delete(authUser).where(eq(authUser.id, userId))
        return { success: true }
      }
      // Self-contained path: guard and delete share one locked
      // transaction so concurrent deletions serialize.
      return await db.transaction(async innerTx => {
        const guard = await deletionGuard(innerTx, userId, true)
        if (guard.error) {
          return { success: false, error: guard.error }
        }
        // Cascades remove sessions and accounts via foreign keys
        await innerTx.delete(authUser).where(eq(authUser.id, userId))
        return { success: true }
      })
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error, 'Failed to delete user')
      }
    }
  }
}
