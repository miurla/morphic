import type { NextRequest, NextResponse } from 'next/server'

export type AuthProviderName = 'supabase' | 'better-auth' | 'none'

/**
 * Provider-agnostic user profile resolved by the server-side identity seam
 * (`getCurrentUser`). All application data continues to be scoped by `id`.
 */
export interface AppUser {
  id: string
  email: string | null
  name?: string | null
  image?: string | null
  createdAt?: Date | string | null
}

/**
 * Static metadata describing which auth operations a provider supports.
 * The UI hides entry points for operations the active provider cannot perform.
 */
export interface AuthCapabilities {
  signUp: boolean
  passwordReset: boolean
  deleteUser: boolean
}

export interface AuthActionResult {
  success: boolean
  error?: string
  /**
   * Present when the client should continue authentication at this URL
   * (e.g. an OAuth redirect to the identity provider).
   */
  redirectTo?: string
}

/**
 * The interface every auth provider implements. Dispatch happens at the
 * existing seams: `getCurrentUser`/`getCurrentUserId` and `proxy.ts`.
 */
export interface AuthProvider {
  readonly name: AuthProviderName
  readonly capabilities: AuthCapabilities

  /** Resolve the current user, or null when unauthenticated. */
  getCurrentUser(): Promise<AppUser | null>

  /** Enforce/refresh the session for an incoming request (used by proxy.ts). */
  handleSession(request: NextRequest): Promise<NextResponse>

  /**
   * Optional identity override used by `getCurrentUserId()`.
   * Defaults to `getCurrentUser()?.id` when not implemented.
   */
  getCurrentUserId?(): Promise<string | undefined>

  signIn?(credentials: {
    email: string
    password: string
  }): Promise<AuthActionResult>
  signInWithOAuth?(provider: string): Promise<AuthActionResult>
  signUp?(credentials: {
    email: string
    password: string
  }): Promise<AuthActionResult>
  signOut?(): Promise<AuthActionResult>
  requestPasswordReset?(email: string): Promise<AuthActionResult>
  updatePassword?(password: string): Promise<AuthActionResult>
  deleteUser?(userId: string): Promise<AuthActionResult>
  /**
   * Returns an error message when the provider is not configured to delete
   * users, or null when deletion is available.
   */
  validateDeleteUserConfig?(): string | null
}
