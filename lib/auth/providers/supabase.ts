import { type NextRequest, NextResponse } from 'next/server'

import type { User as SupabaseUser } from '@supabase/supabase-js'

import { getRequestOrigin } from '@/lib/auth/request'
import type { AppUser, AuthActionResult, AuthProvider } from '@/lib/auth/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasSupabasePublicConfig } from '@/lib/supabase/keys'
import { exchangeRecoveryCode, updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'

function metaString(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value) {
      return value
    }
  }
  return null
}

function toAppUser(user: SupabaseUser): AppUser {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  return {
    id: user.id,
    email: user.email ?? null,
    name: metaString(metadata, 'full_name', 'name'),
    image: metaString(metadata, 'avatar_url', 'picture'),
    createdAt: user.created_at ?? null
  }
}

export const supabaseAuthProvider: AuthProvider = {
  name: 'supabase',
  capabilities: {
    signUp: true,
    passwordReset: true,
    deleteUser: true,
    oauth: true,
    emailVerification: true
  },

  async getCurrentUser(): Promise<AppUser | null> {
    if (!hasSupabasePublicConfig()) {
      return null // Supabase is not configured
    }

    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user ? toAppUser(data.user) : null
  },

  async handleSession(request: NextRequest): Promise<NextResponse> {
    if (!hasSupabasePublicConfig()) {
      // If Supabase is not configured, just pass the request through
      return NextResponse.next({ request })
    }
    const code = request.nextUrl.searchParams.get('code')
    if (request.nextUrl.pathname === '/auth/update-password' && code) {
      return exchangeRecoveryCode(request, code)
    }
    return updateSession(request)
  },

  async signIn({
    email,
    password
  }: {
    email: string
    password: string
  }): Promise<AuthActionResult> {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return error ? { success: false, error: error.message } : { success: true }
  },

  async signInWithOAuth(provider: string): Promise<AuthActionResult> {
    const supabase = await createClient()
    const origin = await getRequestOrigin()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google',
      options: {
        redirectTo: `${origin}/auth/oauth`
      }
    })
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, redirectTo: data.url }
  },

  async signUp({
    email,
    password
  }: {
    email: string
    password: string
  }): Promise<AuthActionResult> {
    const supabase = await createClient()
    const origin = await getRequestOrigin()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/`
      }
    })
    return error ? { success: false, error: error.message } : { success: true }
  },

  async signOut(): Promise<AuthActionResult> {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    return error ? { success: false, error: error.message } : { success: true }
  },

  async requestPasswordReset(email: string): Promise<AuthActionResult> {
    const supabase = await createClient()
    const origin = await getRequestOrigin()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Keep the pre-refactor destination: deployments that already allowlist
      // /auth/update-password in Supabase keep receiving recovery links.
      redirectTo: `${origin}/auth/update-password`
    })
    return error ? { success: false, error: error.message } : { success: true }
  },

  async updatePassword(password: string): Promise<AuthActionResult> {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ password })
    return error ? { success: false, error: error.message } : { success: true }
  },

  validateDeleteUserConfig(): string | null {
    try {
      createAdminClient()
      return null
    } catch (error) {
      console.error('Supabase admin client is not configured:', error)
      return 'Account deletion is not configured. Set SUPABASE_SECRET_KEY.'
    }
  },

  async deleteUser(userId: string): Promise<AuthActionResult> {
    try {
      const adminClient = createAdminClient()
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) {
        throw error
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Failed to delete user'
      }
    }
  }
}
