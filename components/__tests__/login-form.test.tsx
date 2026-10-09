import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signIn, signInWithGoogle } from '@/lib/actions/auth'
import { AppUserProvider } from '@/lib/contexts/app-user-context'

import { LoginForm } from '@/components/login-form'

vi.mock('@/lib/actions/auth', () => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn()
}))

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh })
}))

const capabilities = {
  signUp: true,
  passwordReset: true,
  deleteUser: true,
  oauth: true,
  emailVerification: true
}

function renderForm(override: Partial<typeof capabilities> = {}, user = null) {
  return render(
    <AppUserProvider
      user={user}
      capabilities={{ ...capabilities, ...override }}
    >
      <LoginForm />
    </AppUserProvider>
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs in through the auth server action and refreshes the router', async () => {
    vi.mocked(signIn).mockResolvedValue({ success: true })
    renderForm()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret'
      })
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows the error returned by the auth provider', async () => {
    vi.mocked(signIn).mockResolvedValue({
      success: false,
      error: 'Invalid login credentials'
    })
    renderForm()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to the identity provider for Google sign-in', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' }
    })
    vi.mocked(signInWithGoogle).mockResolvedValue({
      success: true,
      redirectTo: 'https://accounts.google.com/authorize'
    })
    renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Sign In with Google' }))

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalled()
      expect(window.location.href).toBe('https://accounts.google.com/authorize')
    })

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation
    })
  })

  it('hides the Google button when the provider has no OAuth', () => {
    renderForm({ oauth: false })
    expect(
      screen.queryByRole('button', { name: 'Sign In with Google' })
    ).not.toBeInTheDocument()
  })

  it('offers password recovery when the provider supports it', () => {
    renderForm()
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toBeInTheDocument()
  })

  it('hides password recovery when the provider lacks the capability', () => {
    renderForm({ passwordReset: false })
    expect(
      screen.queryByRole('link', { name: 'Forgot password?' })
    ).not.toBeInTheDocument()
  })

  it('shows the Sign Up link by default', () => {
    renderForm()
    expect(screen.getByRole('link', { name: 'Sign Up' })).toBeInTheDocument()
  })

  it('hides Sign Up when the provider lacks the capability', () => {
    renderForm({ signUp: false })
    expect(
      screen.queryByRole('link', { name: 'Sign Up' })
    ).not.toBeInTheDocument()
  })
})
