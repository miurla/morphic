import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updatePassword } from '@/lib/actions/auth'

import { UpdatePasswordForm } from '@/components/update-password-form'

vi.mock('@/lib/actions/auth', () => ({
  updatePassword: vi.fn()
}))

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh })
}))

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'new-password' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))
}

describe('UpdatePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows the provider redirect after a token reset', async () => {
    // A better-auth token reset establishes no session: the provider
    // redirects to sign-in instead of landing logged-out on the root.
    vi.mocked(updatePassword).mockResolvedValue({
      success: true,
      redirectTo: '/auth/login'
    })

    render(<UpdatePasswordForm token="reset-token" />)
    fillAndSubmit()

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith('new-password', 'reset-token')
    })
    expect(push).toHaveBeenCalledWith('/auth/login')
  })

  it('lands on the app root when the provider establishes a session', async () => {
    vi.mocked(updatePassword).mockResolvedValue({ success: true })

    render(<UpdatePasswordForm />)
    fillAndSubmit()

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/')
    })
    expect(refresh).toHaveBeenCalled()
  })
})
