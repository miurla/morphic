'use client'

import { useAppUser } from '@/lib/contexts/app-user-context'

export function useAuthCheck() {
  const user = useAppUser()

  return { user, loading: false, isAuthenticated: !!user }
}
