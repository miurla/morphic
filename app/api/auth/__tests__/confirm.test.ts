import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthProvider } from '@/lib/auth/types'

import { GET } from '../confirm/route'

vi.mock('@/lib/auth/provider', () => ({
  getAuthProvider: vi.fn()
}))

import { getAuthProvider } from '@/lib/auth/provider'

function mockProvider(provider: Partial<AuthProvider>) {
  vi.mocked(getAuthProvider).mockReturnValue(provider as AuthProvider)
}

describe('GET /api/auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exchanges the code and redirects to update-password', async () => {
    const exchange = vi.fn().mockResolvedValue({ success: true } as const)
    mockProvider({ exchangeEmailActionCode: exchange })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/confirm?code=abc123')
    )

    expect(exchange).toHaveBeenCalledWith('abc123')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/update-password'
    )
  })

  it('redirects to login when no code is present', async () => {
    const exchange = vi.fn()
    mockProvider({ exchangeEmailActionCode: exchange })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/confirm')
    )

    expect(exchange).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/login'
    )
  })

  it('redirects to login when the exchange fails', async () => {
    mockProvider({
      exchangeEmailActionCode: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'invalid code' })
    })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/confirm?code=bad')
    )

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/login'
    )
  })

  it('redirects to login when the provider cannot exchange codes', async () => {
    mockProvider({ name: 'none' })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/confirm?code=abc')
    )

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/login'
    )
  })
})
