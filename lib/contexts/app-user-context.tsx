'use client'

import { createContext, useContext, useEffect } from 'react'

import type { AppUser, AuthCapabilities } from '@/lib/auth/types'
import { chatStore } from '@/lib/chat-store'

interface AppUserContextValue {
  user: AppUser | null
  capabilities: AuthCapabilities
}

const NO_CAPABILITIES: AuthCapabilities = {
  signUp: false,
  passwordReset: false,
  deleteUser: false,
  oauth: false,
  emailVerification: false,
  share: false
}

const AppUserContext = createContext<AppUserContextValue>({
  user: null,
  capabilities: NO_CAPABILITIES
})

/**
 * Provides the server-resolved user and the active provider's capabilities to
 * client components, replacing direct Supabase browser-client access.
 */
export function AppUserProvider({
  user,
  capabilities,
  children
}: {
  user: AppUser | null
  capabilities: AuthCapabilities
  children: React.ReactNode
}) {
  useEffect(() => {
    chatStore.setUser(user?.id ?? null)
  }, [user?.id])
  return (
    <AppUserContext.Provider value={{ user, capabilities }}>
      {children}
    </AppUserContext.Provider>
  )
}

export function useAppUser(): AppUser | null {
  return useContext(AppUserContext).user
}

/**
 * Capabilities of the active auth provider. UI entry points for operations
 * the provider cannot perform must be hidden.
 */
export function useAuthCapabilities(): AuthCapabilities {
  return useContext(AppUserContext).capabilities
}
