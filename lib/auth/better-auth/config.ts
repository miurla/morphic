import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import { count } from 'drizzle-orm'

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
  return process.env.AUTH_SIGNUP_MODE === 'invite' ? 'invite' : 'open'
}

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (secret) {
    return secret
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
 * Bootstrap admin: while the user table is empty, the first account to sign
 * up receives the admin role and the window closes permanently. When
 * `BOOTSTRAP_ADMIN_EMAIL` is set, sign-up during the window only succeeds
 * for that email address.
 */
export async function applyBootstrapAdminHook(data: {
  email?: string
  role?: string
}): Promise<{ data: { role: string } } | undefined> {
  const [existing] = await db.select({ total: count() }).from(authSchema.user)

  if ((existing?.total ?? 0) > 0) {
    return undefined // Bootstrap window is closed
  }

  const gate = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  if (gate && data.email?.trim().toLowerCase() !== gate) {
    throw new APIError('FORBIDDEN', {
      message:
        'Sign-up is restricted to the configured BOOTSTRAP_ADMIN_EMAIL address.'
    })
  }

  return { data: { ...data, role: 'admin' } }
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
          before: async user => applyBootstrapAdminHook(user)
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
