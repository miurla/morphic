import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuthProvider } from '@/lib/auth/provider'

import Page from '../sign-up/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth/provider', () => ({ getAuthProvider: vi.fn() }))
vi.mock('@/lib/auth/better-auth/config', () => ({
  getSignUpMode: vi.fn(() => 'open')
}))
vi.mock('@/lib/auth/better-auth/invitations', () => ({
  validateInvitation: vi.fn()
}))
vi.mock('@/components/sign-up-form', () => ({ SignUpForm: () => null }))

import { redirect } from 'next/navigation'

describe('sign-up page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when the provider cannot sign up', async () => {
    vi.mocked(getAuthProvider).mockReturnValue({
      capabilities: { signUp: false }
    } as never)

    await Page({ searchParams: Promise.resolve({}) })

    expect(redirect).toHaveBeenCalledWith('/auth/login')
  })

  it('renders the form when sign-up is supported', async () => {
    vi.mocked(getAuthProvider).mockReturnValue({
      capabilities: { signUp: true }
    } as never)

    await Page({ searchParams: Promise.resolve({}) })

    expect(redirect).not.toHaveBeenCalled()
  })
})
