import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signUp } from '@/lib/actions/auth'
import { AppUserProvider } from '@/lib/contexts/app-user-context'

import { InviteRequired } from '@/components/invite-required'
import { SignUpForm } from '@/components/sign-up-form'

vi.mock('@/lib/actions/auth', () => ({
  signUp: vi.fn()
}))

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh })
}))

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'new@example.com' }
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret-password' }
  })
  fireEvent.change(screen.getByLabelText('Repeat Password'), {
    target: { value: 'secret-password' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
}

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards the invitation token to the sign-up action', async () => {
    vi.mocked(signUp).mockResolvedValue({ success: true })

    render(<SignUpForm token="inv-token" />)
    fillAndSubmit()

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'secret-password',
        token: 'inv-token'
      })
    })
  })

  it('prefills and flags the email an invitation is bound to', async () => {
    vi.mocked(signUp).mockResolvedValue({ success: true })

    render(<SignUpForm token="inv-token" inviteEmail="friend@example.com" />)

    expect(screen.getByLabelText('Email')).toHaveValue('friend@example.com')
    expect(
      screen.getByText(/bound to friend@example\.com/i)
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-password' }
    })
    fireEvent.change(screen.getByLabelText('Repeat Password'), {
      target: { value: 'secret-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: 'friend@example.com',
        password: 'secret-password',
        token: 'inv-token'
      })
    })
  })

  it('signs up without a token in open mode', async () => {
    vi.mocked(signUp).mockResolvedValue({ success: true })

    render(<SignUpForm />)
    fillAndSubmit()

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'secret-password',
        token: undefined
      })
    })
  })
})

describe('InviteRequired', () => {
  it('routes to the app when the provider signs users in immediately', async () => {
    vi.mocked(signUp).mockResolvedValue({ success: true })
    render(
      <AppUserProvider
        user={null}
        capabilities={{
          signUp: true,
          passwordReset: false,
          deleteUser: true,
          oauth: false,
          emailVerification: false
        }}
      >
        <SignUpForm />
      </AppUserProvider>
    )
    fillAndSubmit()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
  })

  it('routes to the confirmation page when email verification is required', async () => {
    vi.mocked(signUp).mockResolvedValue({ success: true })
    render(
      <AppUserProvider
        user={null}
        capabilities={{
          signUp: true,
          passwordReset: true,
          deleteUser: true,
          oauth: true,
          emailVerification: true
        }}
      >
        <SignUpForm />
      </AppUserProvider>
    )
    fillAndSubmit()
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/auth/sign-up-success')
    )
  })

  it('explains that sign-up requires an invitation', () => {
    render(<InviteRequired />)

    expect(
      screen.getByRole('heading', { name: 'Invitation required' })
    ).toBeInTheDocument()
    expect(screen.getByText(/invite-only/i)).toBeInTheDocument()
  })
})
