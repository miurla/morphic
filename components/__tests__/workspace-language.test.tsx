import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signIn } from '@/lib/actions/auth'
import { listSpaces, saveSpace } from '@/lib/actions/spaces'
import { AppUserProvider } from '@/lib/contexts/app-user-context'
import type { Space } from '@/lib/db/schema'

import { LanguageProvider, useI18n } from '@/components/language-provider'
import { LoginForm } from '@/components/login-form'
import { SpacesProvider, useSpaces } from '@/components/spaces/spaces-provider'

vi.mock('@/lib/actions/auth', () => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithOidc: vi.fn()
}))
vi.mock('@/lib/actions/spaces', () => ({
  listSpaces: vi.fn(),
  saveSpace: vi.fn(),
  deleteSpace: vi.fn()
}))
vi.mock('@/lib/analytics/posthog-client', () => ({ captureClient: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}))

function LanguageControls() {
  const { setPreference } = useI18n()
  return (
    <>
      <button onClick={() => setPreference('zh-CN')}>Chinese</button>
      <button onClick={() => setPreference('en')}>English</button>
    </>
  )
}

function SpaceNames() {
  const spaces = useSpaces()
  return (
    <>
      <span data-testid="default-name">{spaces.nameOf('black')}</span>
      <span data-testid="custom-name">{spaces.nameOf('blue')}</span>
      <span data-testid="color-name">{spaces.nameOf('green')}</span>
      <span data-testid="loaded">{String(spaces.loaded)}</span>
    </>
  )
}

describe('workspace language changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('translates a visible auth error and labels without clearing entered credentials', async () => {
    vi.mocked(signIn).mockResolvedValue({
      success: false,
      error: 'Invalid email or password'
    })
    render(
      <LanguageProvider initialLocale="en" initialPreference="en">
        <LanguageControls />
        <AppUserProvider
          user={null}
          capabilities={{
            signUp: true,
            passwordReset: true,
            deleteUser: false,
            oauth: false,
            emailVerification: false,
            share: false
          }}
        >
          <LoginForm />
        </AppUserProvider>
      </LanguageProvider>
    )

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'entered-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    await screen.findByText('Invalid email or password')

    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    expect(screen.getByLabelText('邮箱')).toHaveValue('person@example.com')
    expect(screen.getByLabelText('密码')).toHaveValue('entered-password')
    expect(screen.getByText('邮箱或密码错误')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
    expect(signIn).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('person@example.com')
  })

  it('localizes system space names without changing user-authored names or saving data', async () => {
    const customSpace: Space = {
      id: 'blue-space',
      userId: 'user-1',
      color: 'blue',
      name: 'Blue',
      about: '',
      style: '',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    vi.mocked(listSpaces).mockResolvedValue({
      success: true,
      spaces: [customSpace]
    })
    render(
      <LanguageProvider initialLocale="en" initialPreference="en">
        <LanguageControls />
        <SpacesProvider enabled>
          <SpaceNames />
        </SpacesProvider>
      </LanguageProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('loaded')).toHaveTextContent('true')
    )
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    expect(screen.getByTestId('default-name')).toHaveTextContent('默认')
    expect(screen.getByTestId('color-name')).toHaveTextContent('绿色')
    expect(screen.getByTestId('custom-name')).toHaveTextContent('Blue')
    expect(saveSpace).not.toHaveBeenCalled()
  })
})
