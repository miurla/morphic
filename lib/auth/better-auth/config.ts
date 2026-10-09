import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import { count, eq, ne, sql } from 'drizzle-orm'

import { db } from '@/lib/db'

import * as authSchema from './schema'

export type SignUpMode = 'open' | 'invite'

/**
 * Password reset and invitation emails require SMTP. The `passwordReset`
 * capability of the better-auth provider is gated on this at runtime.
 */
export function isBetterAuthSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  )
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
 * Grant the admin role to the very first account. Runs in a serializable
 * transaction: two concurrent first sign-ups would otherwise both observe an
 * empty user set and both claim the role (write skew), so Postgres aborts
 * one transaction and exactly one account wins the claim.
 *
 * The condition is "no other user exists", not "no admin exists": if the
 * sole admin later deletes their account while regular members remain, a
 * subsequent registrant must not inherit the role. Re-bootstrapping then
 * requires removing every account (the bootstrap window reopens with an
 * empty table) or promoting a successor directly in the database.
 */
export async function claimBootstrapAdmin(userId: string): Promise<void> {
  try {
    await db.transaction(async tx => {
      await tx.execute(sql`set transaction isolation level serializable`)
      const [others] = await tx
        .select({ total: count() })
        .from(authSchema.user)
        .where(ne(authSchema.user.id, userId))
      if ((others?.total ?? 0) > 0) {
        return // Not the first account: the bootstrap window is closed
      }
      await tx
        .update(authSchema.user)
        .set({ role: 'admin' })
        .where(eq(authSchema.user.id, userId))
    })
  } catch (error) {
    // A serialization failure (SQLSTATE 40001) is the expected outcome for
    // the loser of a concurrent first-sign-up race: the other account keeps
    // the admin role and this one stays a regular user. Any other failure
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
      enabled: true
    },
    email: smtpConfigured
      ? {
          server: {
            host: process.env.SMTP_HOST!,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER!,
              pass: process.env.SMTP_PASSWORD!
            }
          },
          from: process.env.EMAIL_FROM ?? 'Morphic <noreply@morphic.local>'
        }
      : undefined,
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
