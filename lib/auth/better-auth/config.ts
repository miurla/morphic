import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { admin, genericOAuth } from 'better-auth/plugins'
import { asc, count, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'

import {
  getOidcProviderName as getOidcProviderNameUtil,
  isOidcConfigured as isOidcConfiguredUtil
} from '../oauth-config'

import { isSmtpConfigured, sendSmtpMail } from './mailer'
import * as authSchema from './schema'

export type SignUpMode = 'open' | 'invite'

/**
 * Password reset and invitation emails require SMTP. The `passwordReset`
 * capability of the better-auth provider is gated on this at runtime.
 */
export function isBetterAuthSmtpConfigured(): boolean {
  return isSmtpConfigured()
}

/**
 * True when OIDC is configured: all required environment variables are set.
 * OIDC_SCOPE is optional and defaults to 'openid profile email'.
 */
export function isOidcConfigured(): boolean {
  return isOidcConfiguredUtil()
}

export function getOidcProviderName(): string {
  return getOidcProviderNameUtil()
}

/**
 * Canonical origin for absolute links delivered by email. Never derived
 * from request headers: `Origin` and `x-forwarded-host` are caller-
 * controlled, and a spoofed value would deliver a valid one-time
 * credential to an attacker domain (host-header injection). Deployments
 * that deliver email must set `BETTER_AUTH_URL`.
 */
export function getEmailLinkOrigin(): string {
  return (process.env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
}

export function getSignUpMode(): SignUpMode {
  const raw = process.env.AUTH_SIGNUP_MODE?.trim().toLowerCase()
  if (!raw) {
    return 'open' // documented default
  }
  if (raw === 'open' || raw === 'invite') {
    return raw
  }
  // A typo must not silently open an invite-only instance to the internet:
  // fail loudly instead of guessing (same policy as BETTER_AUTH_SECRET).
  throw new Error(
    `Invalid AUTH_SIGNUP_MODE "${process.env.AUTH_SIGNUP_MODE}". ` +
      'Expected "open" or "invite".'
  )
}

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (secret) {
    return secret
  }
  if (process.env.NODE_ENV === 'production') {
    // Never fall back to a publicly known secret in production: better-auth
    // must fail fast instead of silently signing with a shared default.
    throw new Error(
      'BETTER_AUTH_SECRET must be set when running AUTH_PROVIDER=better-auth.'
    )
  }
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '⚠️  BETTER_AUTH_SECRET is not set. Using an insecure development ' +
        'secret. Set BETTER_AUTH_SECRET to a stable random value.'
    )
  }
  return 'morphic-better-auth-development-secret'
}

/**
 * Sign-up gate for the bootstrap window: while the user table is empty and
 * `BOOTSTRAP_ADMIN_EMAIL` is set, only that address may sign up. The admin
 * role itself is granted by `claimBootstrapAdmin` once the row exists.
 */
export async function applyBootstrapAdminGate(data: {
  email?: string
}): Promise<void> {
  const [existing] = await db.select({ total: count() }).from(authSchema.user)

  if ((existing?.total ?? 0) > 0) {
    return // Bootstrap window is closed
  }

  const gate = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  if (gate && data.email?.trim().toLowerCase() !== gate) {
    throw new APIError('FORBIDDEN', {
      message:
        'Sign-up is restricted to the configured BOOTSTRAP_ADMIN_EMAIL address.'
    })
  }
}

/**
 * True while the bootstrap window is open: `BOOTSTRAP_ADMIN_EMAIL` is set
 * and the user table is still empty. The sign-up page uses this to render
 * the form (without a token) on a fresh invite-only instance; the address
 * itself is enforced by `applyBootstrapAdminGate` at creation time.
 */
export async function isBootstrapWindowOpen(): Promise<boolean> {
  if (!process.env.BOOTSTRAP_ADMIN_EMAIL?.trim()) {
    return false
  }
  const [existing] = await db.select({ total: count() }).from(authSchema.user)
  return (existing?.total ?? 0) === 0
}

/**
 * True when the email is the seed administrator of a fresh instance:
 * `BOOTSTRAP_ADMIN_EMAIL` is set, the address matches, and the user table
 * is still empty. Invite-only instances use this to let the first admin
 * sign up without an invitation — creating invitations requires an admin,
 * so the instance would otherwise have no way to bootstrap.
 */
export async function isBootstrapAccount(email: string): Promise<boolean> {
  const gate = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  if (!gate || email.trim().toLowerCase() !== gate) {
    return false
  }
  return isBootstrapWindowOpen()
}

/**
 * Runs an admin-election transaction with retries. A serialization
 * failure (SQLSTATE 40001) does not by itself prove a concurrent
 * claimant committed: both transactions can abort. Retry it like any
 * other transient failure — a real winner shows up as an existing admin
 * on the next attempt, and if nobody won the retry completes the
 * election instead of stranding the instance without an admin.
 */
async function withElectionRetry(
  label: string,
  run: () => Promise<void>
): Promise<void> {
  // Bounded on purpose: the hook runs inside the sign-up (or deletion)
  // request after the account work already committed, so retrying
  // forever would hang the response indefinitely. The window is short
  // but covers transient blips; exhaustion is a repair-needed condition
  // logged loudly — the election is deterministic, so a single manual
  // promotion restores the invariant.
  const maxAttempts = 6
  for (let attempt = 1; ; attempt++) {
    try {
      await run()
      return
    } catch (error) {
      if (attempt >= maxAttempts) {
        console.error(
          `${label} failed after ${maxAttempts} attempts — repair needed. ` +
            'If the instance is now without an admin, promote the intended ' +
            `account directly: UPDATE "user" SET role = 'admin' ` +
            "WHERE id = '<account id>'. Later sign-ups cannot take the " +
            'claim because the election requires the earliest account.',
          error
        )
        return
      }
      await new Promise(resolve =>
        setTimeout(resolve, Math.min(100 * 2 ** (attempt - 1), 500))
      )
    }
  }
}

/**
 * Grant the admin role to the very first account.
 *
 * The after-create hook runs in its own transaction once the sign-up has
 * committed, so two concurrent first sign-ups can each observe the other's
 * committed row: a "no other user exists" condition would make both decline
 * and leave the instance without any admin. The claim is therefore a
 * deterministic election — the role goes to the earliest account (createdAt,
 * tie-broken by id) whenever no admin exists. Exactly one of any set of
 * concurrent sign-ups can be the earliest, so exactly one account claims the
 * role regardless of interleaving.
 *
 * "No admin exists" alone would allow escalation: if the sole admin later
 * deletes their account while regular members remain, the next registrant
 * must not inherit the role — and it cannot be the earliest account, so the
 * election declines it. Re-bootstrapping then requires removing every
 * account (the bootstrap window reopens with an empty table) or promoting a
 * successor directly in the database.
 */
export async function claimBootstrapAdmin(userId: string): Promise<void> {
  // A transient failure here (e.g. the connection drops after the user
  // insert already committed) must not strand the instance without an
  // admin: the earliest-account guard means no later sign-up can take the
  // claim over, so retry before giving up.
  await withElectionRetry('Bootstrap admin claim', () =>
    db.transaction(async tx => {
      await tx.execute(sql`set transaction isolation level serializable`)
      const [admin] = await tx
        .select({ id: authSchema.user.id })
        .from(authSchema.user)
        .where(eq(authSchema.user.role, 'admin'))
        .limit(1)
      if (admin) {
        return // An admin exists: the bootstrap window is closed
      }
      const [earliest] = await tx
        .select({ id: authSchema.user.id })
        .from(authSchema.user)
        .orderBy(asc(authSchema.user.createdAt), asc(authSchema.user.id))
        .limit(1)
      if (earliest?.id !== userId) {
        return // Not the earliest account: another sign-up owns the claim
      }
      await tx
        .update(authSchema.user)
        .set({ role: 'admin' })
        .where(eq(authSchema.user.id, userId))
    })
  )
}

/**
 * Completes the bootstrap election after the last admin account is
 * deleted. A sign-up that commits while the deletion is in flight sees
 * the admin row in its own claim and declines; the deletion's locked
 * count in turn cannot see the uncommitted insert. Running the election
 * again after the deletion commits closes the window: the sign-up's
 * claim runs after its insert commits and the re-election runs after
 * the deletion commits, so neither can miss the other without a
 * timestamp cycle — at least one of them observes both states and the
 * earliest account takes the role.
 */
export async function reElectBootstrapAdmin(): Promise<void> {
  await withElectionRetry('Bootstrap admin re-election', () =>
    db.transaction(async tx => {
      await tx.execute(sql`set transaction isolation level serializable`)
      const [admin] = await tx
        .select({ id: authSchema.user.id })
        .from(authSchema.user)
        .where(eq(authSchema.user.role, 'admin'))
        .limit(1)
      if (admin) {
        return // An admin exists: nothing to re-elect
      }
      const [earliest] = await tx
        .select({ id: authSchema.user.id })
        .from(authSchema.user)
        .orderBy(asc(authSchema.user.createdAt), asc(authSchema.user.id))
        .limit(1)
      if (!earliest) {
        return // Empty table: the bootstrap window is the recovery path
      }
      await tx
        .update(authSchema.user)
        .set({ role: 'admin' })
        .where(eq(authSchema.user.id, earliest.id))
    })
  )
}

/**
 * Live gate state for implicit OIDC account creation (process-wide):
 *
 * - `null`: the user table has not been measured yet. The gate stays on
 *   while the environment could open a bootstrap window, and a one-shot
 *   calibration query settles it.
 * - `true`: the table is empty — the bootstrap window is open (the first
 *   account requires the emailed bootstrap link).
 * - `false`: an account exists — implicit sign-up follows the sign-up
 *   mode policy alone.
 */
let bootstrapWindowEmpty: boolean | null = null

/**
 * Set for an auth instance whose OIDC gate exists **only** because the
 * bootstrap window is open (never for invite/invalid sign-up mode, which
 * is a permanent policy). The first account creation lifts the gate by
 * rebuilding the memoized instance.
 */
let bootstrapOidcGateReleasable = false

/** True once the calibration query ran; guards against rebuild loops. */
let bootstrapOidcCalibrated = false

/**
 * Timestamp of the last failed calibration count query (0 = none): a failed
 * measurement re-arms itself after {@link BOOTSTRAP_CALIBRATION_RETRY_MS},
 * so a transient database outage during the calibration does not leave
 * implicit OIDC sign-up blocked until a process restart.
 */
let bootstrapOidcCalibrationFailedAt = 0

/** Throttle for re-measuring after a failed calibration count query. */
export const BOOTSTRAP_CALIBRATION_RETRY_MS = 5_000

/**
 * Decide when a failed bootstrap-window calibration may re-run: a bounded
 * retry (instance rebuild + count query) at most once per retry interval.
 * The gate stays closed (safe side) until a successful count proves the
 * window closed.
 */
export function isBootstrapCalibrationRetryDue(
  failedAtMs: number,
  nowMs: number
): boolean {
  return failedAtMs > 0 && nowMs - failedAtMs >= BOOTSTRAP_CALIBRATION_RETRY_MS
}

/** True when OIDC + SMTP + BOOTSTRAP_ADMIN_EMAIL can gate at all. */
let bootstrapOidcGatePossible = false

/**
 * Decide whether the generic OIDC provider must reject unknown identities
 * at the callback (better-auth's `disableSignUp`). Rules:
 *
 * - invite/invalid sign-up mode: always blocked — no implicit members, and
 *   the gate is permanent, so unrelated first-account events must never
 *   lift it.
 * - open mode with SMTP and `BOOTSTRAP_ADMIN_EMAIL`: the bootstrap window
 *   demands mailbox proof for the first account. An OAuth callback cannot
 *   prove mailbox ownership, so the gate stays on while the window is
 *   open; it lifts with the first account.
 * - open mode otherwise: implicit sign-up allowed.
 *
 * `userTableEmpty === null` means "not measured yet" and errs on the safe
 * side (blocked until proven allowed).
 */
export function isOidcImplicitSignUpBlocked(params: {
  signUpModeAllowsImplicit: boolean
  smtpConfigured: boolean
  bootstrapAddressConfigured: boolean
  /** null before the user-table state was measured. */
  userTableEmpty: boolean | null
}): { blocked: boolean; liftsWithFirstAccount: boolean } {
  if (!params.signUpModeAllowsImplicit) {
    return { blocked: true, liftsWithFirstAccount: false }
  }
  if (!params.smtpConfigured || !params.bootstrapAddressConfigured) {
    return { blocked: false, liftsWithFirstAccount: false }
  }
  const windowOpen = params.userTableEmpty !== false
  return { blocked: windowOpen, liftsWithFirstAccount: windowOpen }
}

/**
 * `createAuth` is synchronous and must not await a database read: it starts
 * optimistically with the window open and measures once per instance. A
 * rebuild that measured again could recurse, hence the sticky
 * `bootstrapOidcCalibrated` flag: only a real state change (first account /
 * reset) or a failed attempt (re-armed by getAuth after the retry interval)
 * re-arms the measurement.
 */
function scheduleBootstrapWindowCalibration(): void {
  if (bootstrapOidcCalibrated) {
    return
  }
  bootstrapOidcCalibrated = true
  void (async () => {
    try {
      const [row] = await db.select({ total: count() }).from(authSchema.user)
      if ((row?.total ?? 0) > 0 && bootstrapWindowEmpty !== false) {
        // Accounts predate this process: the window closed before boot.
        bootstrapWindowEmpty = false
        bootstrapOidcCalibrationFailedAt = 0
        authInstance = null // next getAuth() rebuilds with the gate off
      } else if ((row?.total ?? 0) === 0) {
        bootstrapWindowEmpty = true
        bootstrapOidcCalibrationFailedAt = 0
      }
    } catch (error) {
      // Transient database outage: keep the gate closed (safe side) and
      // re-arm the measurement — getAuth() rebuilds the instance after the
      // retry interval and re-runs the count query, so registration is not
      // stuck until a process restart.
      bootstrapOidcCalibrationFailedAt = Date.now()
      console.warn(
        'Could not measure the bootstrap window state for OIDC sign-up; ' +
          'the gate stays on until a successful count closes the window ' +
          '(retried after ' +
          BOOTSTRAP_CALIBRATION_RETRY_MS +
          ' ms).',
        error
      )
    }
  })()
}

/**
 * Lift the bootstrap-only OIDC gate after an account was created: the
 * window closed, so implicit sign-up follows the sign-up mode policy
 * again (rebuild the memoized instance). Called from the user-create
 * database hook — the credential bootstrap sign-up is the only route that
 * can create the first account while the gate is active.
 */
function releaseOidcBootstrapGate(): void {
  if (!bootstrapOidcGateReleasable) {
    return // permanent gate (invite/invalid mode) or nothing was gated
  }
  bootstrapOidcGateReleasable = false
  bootstrapWindowEmpty = false // the first account closed the window
  authInstance = null // next getAuth() rebuilds without the gate
}

/**
 * Account deletions can reopen the bootstrap window (the table can become
 * empty again). Reset the calibration so the next auth instance re-derives
 * the window from the live user-table state; no-op when the gate never
 * applied.
 */
export function resetOidcBootstrapGate(): void {
  if (!bootstrapOidcGatePossible) {
    return
  }
  bootstrapOidcCalibrated = false
  bootstrapOidcCalibrationFailedAt = 0
  bootstrapWindowEmpty = null
  bootstrapOidcGateReleasable = false
  authInstance = null
}

function createAuth() {
  const smtpConfigured = isBetterAuthSmtpConfigured()
  const oidcConfigured = isOidcConfigured()

  // An identity provider's tenant must not gain members outside the sign-up
  // policy: implicit OAuth sign-up is only allowed in explicitly open mode.
  // An invalid AUTH_SIGNUP_MODE fails closed (unless it says "open", the
  // user creation stays disabled); the credential sign-up path still throws
  // its explanatory error before reaching the database hook.
  const oidcSignUpAllowed = (() => {
    try {
      return getSignUpMode() === 'open'
    } catch (error) {
      console.warn(
        'AUTH_SIGNUP_MODE is invalid — disabling implicit OIDC sign-up.',
        error
      )
      return false
    }
  })()

  // Mailbox proof anchors the bootstrap window: with SMTP configured, the
  // first account is created only through the emailed bootstrap link
  // (invitedBy = 'bootstrap'), so whoever owns the operator's address
  // proves it. An OIDC callback account-creates directly, without any
  // chance to prove that mailbox — so the gate follows the LIVE window
  // state (isOidcImplicitSignUpBlocked): once the first account closes it,
  // implicit OIDC sign-up resumes under the sign-up mode policy alone.
  // SMTP-off bootstrap keeps the address gate as its (accepted) proof,
  // same as credential sign-up. When the state is not measured yet, the
  // gate errs on the safe side and a one-shot calibration settles it.
  const oidcGate = isOidcImplicitSignUpBlocked({
    signUpModeAllowsImplicit: oidcSignUpAllowed,
    smtpConfigured,
    bootstrapAddressConfigured: Boolean(
      process.env.BOOTSTRAP_ADMIN_EMAIL?.trim()
    ),
    userTableEmpty: bootstrapWindowEmpty
  })
  bootstrapOidcGatePossible =
    oidcConfigured && smtpConfigured && oidcGate.liftsWithFirstAccount === true
  bootstrapOidcGateReleasable = false
  if (oidcGate.blocked && oidcGate.liftsWithFirstAccount) {
    bootstrapOidcGateReleasable = true
    scheduleBootstrapWindowCalibration()
  }

  // Conditionally spread the OIDC plugin inline so the concrete plugin
  // types reach betterAuth(): a `plugins: any[]` assertion would strip
  // every declared endpoint (e.g. admin's setRole/setUserPassword) from
  // the inferred auth.api type.
  const oidcPlugins = oidcConfigured
    ? [
        genericOAuth({
          config: [
            {
              providerId: 'oidc',
              // Trailing slash is a common typo: without stripping, the
              // discovery URL becomes "...//.well-known/..." and most IdPs
              // answer 404, which better-auth reports as "discovery left no
              // usable authorization endpoint or token exchange".
              discoveryUrl: `${process.env.OIDC_ISSUER?.trim().replace(/\/+$/, '')}/.well-known/openid-configuration`,
              clientId: process.env.OIDC_CLIENT_ID?.trim() ?? '',
              clientSecret: process.env.OIDC_CLIENT_SECRET?.trim() ?? '',
              scopes: (
                process.env.OIDC_SCOPE?.trim() || 'openid profile email'
              ).split(' '),
              pkce: true,
              // Unknown identities rejected while the sign-up mode or the
              // open bootstrap window says so; known users can still sign
              // in. In invite-only instances members register through the
              // credential sign-up flow (invitation token) and use OIDC
              // thereafter. The bootstrap window gate lifts with the first
              // account (see releaseOidcBootstrapGate).
              disableSignUp: oidcGate.blocked,
              // Map OIDC claims to Better Auth user fields
              // Note: Do not map 'id' here - Better Auth gets user identity from
              // the accountSubject (OIDC 'sub' claim) automatically
              mapProfileToUser: profile => ({
                email: profile.email as string,
                emailVerified: (profile.email_verified ?? false) as boolean,
                name: (profile.name ||
                  profile.preferred_username ||
                  profile.email) as string,
                image: profile.picture as string | undefined
              })
            }
          ]
        })
      ]
    : []

  // nextCookies must stay last: it re-applies the session cookie
  // through next/headers so server actions (signIn/signUp/signOut)
  // deliver it to the browser without a hand-written header copy.

  return betterAuth({
    appName: 'Morphic',
    secret: getSecret(),
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      // better-auth 1.7 removed the built-in nodemailer transport: without
      // this callback, requestPasswordReset fails with RESET_PASSWORD_DISABLED
      // even when the SMTP variables are present. Morphic does not use email
      // verification, so this is the only email better-auth delivers;
      // invitation mail goes through lib/actions/admin.ts.
      sendResetPassword: smtpConfigured
        ? async ({ user, token }) => {
            // better-auth's generated url targets its own
            // /api/auth/reset-password/:token endpoint, which this app does
            // not expose (the mounted HTTP surface is restricted to provider
            // callbacks, see app/api/auth/[...all]/route.ts), so it would 404.
            // Link the in-app page directly with the raw token instead; it
            // resets the password through the provider's server action.
            const origin = getEmailLinkOrigin()
            if (!origin) {
              // Without a canonical origin the link could only be built
              // from caller-controlled headers: fail loudly rather than
              // deliver a live credential to the wrong host.
              throw new Error(
                'BETTER_AUTH_URL must be set to deliver password reset emails'
              )
            }
            const link = `${origin}/auth/update-password?token=${token}`
            await sendSmtpMail({
              to: user.email,
              subject: 'Reset your Morphic password',
              text: `Use this link to reset your password (valid for one hour): ${link}`,
              html: `<p>Use this link to reset your password (valid for one hour):</p><p><a href="${link}">Reset password</a></p>`
            })
          }
        : undefined
    },
    plugins: [admin({ defaultRole: 'user' }), ...oidcPlugins, nextCookies()],
    databaseHooks: {
      user: {
        create: {
          before: async user => applyBootstrapAdminGate(user),
          after: async user => {
            await claimBootstrapAdmin(user.id)
            // The bootstrap window closes with the first account; if this
            // instance gated OIDC only for the window, lift the gate by
            // rebuilding (the currently-running request keeps its own
            // instance reference; later requests pick the new one up).
            releaseOidcBootstrapGate()
          }
        }
      }
    }
  })
}

export type BetterAuth = ReturnType<typeof createAuth>

let authInstance: BetterAuth | null = null

/** Lazily create the shared Better Auth instance. */
export function getAuth(): BetterAuth {
  // A failed calibration re-arms itself: rebuild the instance (which
  // re-schedules the count query) at most once per retry interval, so a
  // transient database outage heals without hammering the database or
  // blocking implicit OIDC sign-up until a process restart.
  if (
    authInstance &&
    isBootstrapCalibrationRetryDue(bootstrapOidcCalibrationFailedAt, Date.now())
  ) {
    bootstrapOidcCalibrationFailedAt = 0
    bootstrapOidcCalibrated = false
    authInstance = null // rebuild below re-schedules the measurement
  }
  if (!authInstance) {
    authInstance = createAuth()
  }
  return authInstance
}

/** Test seam: reset the memoized instance after changing env vars. */
export function resetAuthInstance(): void {
  authInstance = null
  bootstrapWindowEmpty = null
  bootstrapOidcGateReleasable = false
  bootstrapOidcCalibrated = false
  bootstrapOidcCalibrationFailedAt = 0
}
