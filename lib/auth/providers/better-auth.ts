import { headers } from 'next/headers'
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
import { checkRateLimit } from '@/lib/auth/rate-limit'
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
  // The admin listing is locked first, before the target is classified:
  // locking each own target first would let two concurrent admin
  // deletions each hold the row the other needs, deadlocking. When
  // every guard requests the shared admin set as its first lock, the
  // second deletion simply waits for the first scan to commit.
  const adminsQuery = q
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.role, 'admin'))
  const admins = lock ? await adminsQuery.for('update') : await adminsQuery

  // The target row is then locked before its role is read: a concurrent
  // promotion must not let a soon-to-be-admin slip past the last-admin
  // guard while its own deletion is already in flight.
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
 * The action-level rate limiter bounds attempts per IP+email, but a
 * patient caller can still space requests a minute apart; this cooldown
 * is what keeps the mailbox quiet while the bootstrap token is being
 * chased down.
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

const TOO_MANY_REQUESTS = 'Too many attempts. Please try again in a minute.'

async function clientIp(): Promise<string> {
  const requestHeaders = await headers()
  const forwarded = requestHeaders.get('x-forwarded-for')
  return (
    forwarded?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    'local'
  )
}

/**
 * Bounds repeated auth attempts per IP+email. better-auth's own rate
 * limiter only runs in its HTTP handler, which Morphic does not mount,
 * so the direct auth.api.* actions need their own throttle.
 */
async function attemptAllowed(action: string, email: string): Promise<boolean> {
  const ip = await clientIp()
  return checkRateLimit(`${action}:${ip}:${email.trim().toLowerCase()}`)
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
    if (!(await attemptAllowed('sign-in', email))) {
      return { success: false, error: TOO_MANY_REQUESTS }
    }
    try {
      await getAuth().api.signInEmail({
        body: { email, password },
        headers: await headers()
      })
      // The nextCookies plugin stores the session cookie through
      // next/headers; no manual set-cookie copy is needed (and a manual
      // cookies().set of the raw header would double-encode the signed
      // value, breaking the signature check on read).
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
    if (!(await attemptAllowed('sign-up', email))) {
      return { success: false, error: TOO_MANY_REQUESTS }
    }
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
              // A live link is already on its way: the per-address
              // cooldown keeps the mailbox quiet while the operator
              // chases down the first link.
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
        // An ordinary invitation (invitedBy = the inviting admin) for
        // the same address must not claim admin: only the invitation
        // this branch mailed itself (invitedBy = 'bootstrap') proves
        // mailbox control of the gated address.
        invitation.invitedBy !== 'bootstrap' ||
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
      const response = await getAuth().api.signUpEmail({
        body: { name: email, email, password },
        headers: await headers()
      })

      // signUpEmail resolves to `{ token, user }` — there is no `session`
      // field. The token is the session token the nextCookies plugin
      // delivers to the browser, so its presence is the success signal.
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
      await getAuth().api.signOut({
        headers: await headers()
      })
      // The nextCookies plugin clears the session cookie through
      // next/headers; no manual set-cookie copy is needed.
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
    if (!(await attemptAllowed('password-reset', email))) {
      return { success: false, error: TOO_MANY_REQUESTS }
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
