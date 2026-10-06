import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AppUser } from '@/lib/auth/types'
import { AppUserProvider } from '@/lib/contexts/app-user-context'

import { useAuthCheck } from '@/hooks/use-auth-check'
import { useCurrentUserImage } from '@/hooks/use-current-user-image'
import { useCurrentUserName } from '@/hooks/use-current-user-name'

const capabilities = { signUp: true, passwordReset: true, deleteUser: true }

const user: AppUser = {
  id: 'user-1',
  email: 'person@example.com',
  name: 'Test Person',
  image: 'https://example.com/avatar.png'
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppUserProvider user={user} capabilities={capabilities}>
      {children}
    </AppUserProvider>
  )
}

function emptyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppUserProvider user={null} capabilities={capabilities}>
      {children}
    </AppUserProvider>
  )
}

describe('useAuthCheck', () => {
  it('reports the authenticated user from context', () => {
    const { result } = renderHook(() => useAuthCheck(), { wrapper })

    expect(result.current.user).toEqual(user)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('reports no user when unauthenticated', () => {
    const { result } = renderHook(() => useAuthCheck(), {
      wrapper: emptyWrapper
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})

describe('useCurrentUserName', () => {
  it('returns the user display name', () => {
    const { result } = renderHook(() => useCurrentUserName(), { wrapper })
    expect(result.current).toBe('Test Person')
  })

  it('falls back to a placeholder without a user', () => {
    const { result } = renderHook(() => useCurrentUserName(), {
      wrapper: emptyWrapper
    })
    expect(result.current).toBe('?')
  })
})

describe('useCurrentUserImage', () => {
  it('returns the user avatar URL', () => {
    const { result } = renderHook(() => useCurrentUserImage(), { wrapper })
    expect(result.current).toBe('https://example.com/avatar.png')
  })

  it('returns null without an avatar or user', () => {
    const { result } = renderHook(() => useCurrentUserImage(), {
      wrapper: emptyWrapper
    })
    expect(result.current).toBeNull()
  })
})
