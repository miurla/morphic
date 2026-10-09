import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import { asc, count, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'

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
  try {
    await db.transaction(async tx => {
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
  } catch (error) {
    // A serialization failure (SQLSTATE 40001) is the expected outcome for
    // the loser of a concurrent first-sign-up race: the winner keeps the
    // admin role and this account stays a regular user. Any other failure
    // would silently leave the instance without an admin, so surface it.
    if ((error as { code?: string } | null)?.code !== '40001') {
      console.error('Bootstrap admin claim failed:', error)
    }
  }
}

function createAuth() {
  const smtpConfigured = isBetterAuthSmtpConfigured()

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
        ? async ({ user, url }) => {
            await sendSmtpMail({
              to: user.email,
              subject: 'Reset your Morphic password',
              text: `Use this link to reset your password (valid for one hour): ${url}`,
              html: `<p>Use this link to reset your password (valid for one hour):</p><p><a href="${url}">Reset password</a></p>`
            })
          }
        : undefined
    },
    plugins: [admin({ defaultRole: 'user' })],
    databaseHooks: {
      user: {
        create: {
          before: async user => applyBootstrapAdminGate(user),
          after: async user => {
            await claimBootstrapAdmin(user.id)
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
  if (!authInstance) {
    authInstance = createAuth()
  }
  return authInstance
}

/** Test seam: reset the memoized instance after changing env vars. */
export function resetAuthInstance(): void {
  authInstance = null
}
