import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSignUpMode,
  isBootstrapWindowOpen
} from '@/lib/auth/better-auth/config'
import { validateInvitation } from '@/lib/auth/better-auth/invitations'
import { getAuthProvider } from '@/lib/auth/provider'

import Page from '../sign-up/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth/provider', () => ({ getAuthProvider: vi.fn() }))
vi.mock('@/lib/auth/better-auth/config', () => ({
  getSignUpMode: vi.fn(() => 'open'),
  isBootstrapWindowOpen: vi.fn(async () => false)
}))
vi.mock('@/lib/auth/better-auth/invitations', () => ({
  validateInvitation: vi.fn()
}))
vi.mock('@/components/sign-up-form', () => ({ SignUpForm: () => null }))
vi.mock('@/components/invite-required', () => ({ InviteRequired: () => null }))

import { redirect } from 'next/navigation'

import { InviteRequired } from '@/components/invite-required'

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

  it('passes the bound invitation email to the form', async () => {
    vi.mocked(getAuthProvider).mockReturnValue({
      name: 'better-auth',
      capabilities: { signUp: true }
    } as never)
    vi.mocked(getSignUpMode).mockReturnValue('invite')
    vi.mocked(validateInvitation).mockResolvedValue({
      id: 'inv-1',
      email: 'friend@example.com'
    } as never)

    const tree = (await Page({
      searchParams: Promise.resolve({ token: 'tok' })
    })) as unknown as {
      props: {
        children: { props: { children: { props: Record<string, unknown> } } }
      }
    }

    expect(tree.props.children.props.children.props).toMatchObject({
      token: 'tok',
      inviteEmail: 'friend@example.com'
    })
  })

  it('renders the form while the bootstrap window is open in invite mode', async () => {
    // Fresh invite-only instance: the gated address must reach the form;
    // the address itself is enforced at creation time.
    vi.mocked(getAuthProvider).mockReturnValue({
      name: 'better-auth',
      capabilities: { signUp: true }
    } as never)
    vi.mocked(getSignUpMode).mockReturnValue('invite')
    vi.mocked(validateInvitation).mockResolvedValue(null)
    vi.mocked(isBootstrapWindowOpen).mockResolvedValue(true)

    const tree = (await Page({
      searchParams: Promise.resolve({})
    })) as unknown as {
      props: { children: { props: { children: { type: unknown } } } }
    }

    expect(tree.props.children.props.children.type).not.toBe(InviteRequired)
  })

  it('shows the invite wall in invite mode once the bootstrap window closed', async () => {
    vi.mocked(getAuthProvider).mockReturnValue({
      name: 'better-auth',
      capabilities: { signUp: true }
    } as never)
    vi.mocked(getSignUpMode).mockReturnValue('invite')
    vi.mocked(validateInvitation).mockResolvedValue(null)
    vi.mocked(isBootstrapWindowOpen).mockResolvedValue(false)

    const tree = (await Page({
      searchParams: Promise.resolve({})
    })) as unknown as {
      props: { children: { props: { children: { type: unknown } } } }
    }

    expect(tree.props.children.props.children.type).toBe(InviteRequired)
  })
})
