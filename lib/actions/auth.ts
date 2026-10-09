'use server'

import { getAuthProvider } from '@/lib/auth/provider'
import type { AuthActionResult } from '@/lib/auth/types'

function unavailable(): AuthActionResult {
  return { success: false, error: 'Authentication is not available.' }
}

export async function signIn(credentials: {
  email: string
  password: string
}): Promise<AuthActionResult> {
  const provider = getAuthProvider()
  if (!provider.signIn) {
    return unavailable()
  }
  return provider.signIn(credentials)
}

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const provider = getAuthProvider()
  if (!provider.signInWithOAuth) {
    return unavailable()
  }
  return provider.signInWithOAuth('google')
}

export async function signUp(credentials: {
  email: string
  password: string
  token?: string
}): Promise<AuthActionResult> {
  const provider = getAuthProvider()
  if (!provider.signUp) {
    return unavailable()
  }
  return provider.signUp(credentials)
}

export async function signOut(): Promise<AuthActionResult> {
  const provider = getAuthProvider()
  if (!provider.signOut) {
    return unavailable()
  }
  return provider.signOut()
}

export async function requestPasswordReset(
  email: string
): Promise<AuthActionResult> {
  const provider = getAuthProvider()
  if (!provider.requestPasswordReset) {
    return unavailable()
  }
  return provider.requestPasswordReset(email)
}

export async function updatePassword(
  password: string,
  token?: string
): Promise<AuthActionResult> {
  const provider = getAuthProvider()
  if (!provider.updatePassword) {
    return unavailable()
  }
  return provider.updatePassword(password, token)
}
