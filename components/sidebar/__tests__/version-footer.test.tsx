import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { isAnonymousMode } from '@/lib/auth/provider'
import type { AppUser } from '@/lib/auth/types'
import { checkForUpdate } from '@/lib/version/update-check'

import packageJson from '../../../package.json'
import { VersionFooter } from '../version-footer'

vi.mock('@/lib/auth/provider', () => ({
  isAnonymousMode: vi.fn()
}))

vi.mock('@/lib/version/update-check', () => ({
  checkForUpdate: vi.fn()
}))

const mockedIsAnonymousMode = vi.mocked(isAnonymousMode)
const mockedCheckForUpdate = vi.mocked(checkForUpdate)

const UPDATE_RESULT = {
  hasUpdate: true,
  latestVersion: 'v1.9.0',
  releaseUrl: 'https://github.com/miurla/morphic/releases/tag/v1.9.0'
}

function appUser(role?: string): AppUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    role
  }
}

async function renderFooter(user?: AppUser | null) {
  render(await VersionFooter({ user }))
}

describe('VersionFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('MORPHIC_INSTALL_METHOD', 'docker')
    mockedIsAnonymousMode.mockReturnValue(false)
    mockedCheckForUpdate.mockResolvedValue({ hasUpdate: false })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('shows the version link and install label when up to date', async () => {
    await renderFooter()

    const versionLink = screen.getByRole('link', {
      name: `v${packageJson.version}`
    })
    expect(versionLink).toHaveAttribute(
      'href',
      'https://github.com/miurla/morphic/releases'
    )
    expect(versionLink).toHaveAttribute('target', '_blank')
    expect(versionLink).toHaveAttribute('rel', 'noopener')
    expect(screen.getByText('docker')).toBeInTheDocument()
    expect(screen.queryByText(/Update:/)).not.toBeInTheDocument()
  })

  test('shows the update link to an admin', async () => {
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(appUser('admin'))

    const updateLink = screen.getByRole('link', { name: 'Update: v1.9.0' })
    expect(updateLink).toHaveAttribute(
      'href',
      'https://github.com/miurla/morphic/releases/tag/v1.9.0'
    )
    expect(updateLink).toHaveAttribute('target', '_blank')
    expect(updateLink).toHaveAttribute('rel', 'noopener')
    expect(screen.queryByText('docker')).not.toBeInTheDocument()
  })

  test('hides the update link from non-admin users', async () => {
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(appUser('user'))

    expect(screen.queryByText(/Update:/)).not.toBeInTheDocument()
    expect(screen.getByText('docker')).toBeInTheDocument()
  })

  test('hides the update link when the provider exposes no role', async () => {
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(appUser())

    expect(screen.queryByText(/Update:/)).not.toBeInTheDocument()
    expect(screen.getByText('docker')).toBeInTheDocument()
  })

  test('shows the update link to an allowlisted email without a role', async () => {
    vi.stubEnv('MORPHIC_ADMIN_EMAILS', 'user@example.com')
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(appUser())

    expect(
      screen.getByRole('link', { name: 'Update: v1.9.0' })
    ).toBeInTheDocument()
  })

  test('matches allowlisted emails case-insensitively', async () => {
    vi.stubEnv('MORPHIC_ADMIN_EMAILS', 'other@example.com, USER@Example.COM')
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(appUser())

    expect(
      screen.getByRole('link', { name: 'Update: v1.9.0' })
    ).toBeInTheDocument()
  })

  test('hides the update link for an email outside the allowlist', async () => {
    vi.stubEnv('MORPHIC_ADMIN_EMAILS', 'someone-else@example.com')
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(appUser())

    expect(screen.queryByText(/Update:/)).not.toBeInTheDocument()
  })

  test('shows the update link in anonymous mode without a resolved user', async () => {
    mockedIsAnonymousMode.mockReturnValue(true)
    mockedCheckForUpdate.mockResolvedValue(UPDATE_RESULT)

    await renderFooter(null)

    expect(
      screen.getByRole('link', { name: 'Update: v1.9.0' })
    ).toBeInTheDocument()
  })

  test('degrades to version and label when the check throws', async () => {
    mockedCheckForUpdate.mockRejectedValue(new Error('boom'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await renderFooter()

    expect(
      screen.getByRole('link', { name: `v${packageJson.version}` })
    ).toBeInTheDocument()
    expect(screen.getByText('docker')).toBeInTheDocument()
    expect(screen.queryByText(/Update:/)).not.toBeInTheDocument()

    warnSpy.mockRestore()
  })
})
