import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserId = vi.fn()
const mockDeleteSourcePreferenceProfile = vi.fn()
const mockListSourcePreferenceProfiles = vi.fn()
const mockUpsertSourcePreferenceProfile = vi.fn()

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

vi.mock('@/lib/actions/source-preferences', () => ({
  deleteSourcePreferenceProfile: (...args: unknown[]) =>
    mockDeleteSourcePreferenceProfile(...args),
  listSourcePreferenceProfiles: (...args: unknown[]) =>
    mockListSourcePreferenceProfiles(...args),
  upsertSourcePreferenceProfile: (...args: unknown[]) =>
    mockUpsertSourcePreferenceProfile(...args)
}))

import { DELETE, GET, POST } from '../route'

describe('source preference profiles API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockListSourcePreferenceProfiles.mockResolvedValue({
      success: true,
      profiles: []
    })
    mockUpsertSourcePreferenceProfile.mockResolvedValue({
      success: true,
      profile: { id: 'profile_123', name: 'Climate', slug: 'climate' },
      created: true
    })
    mockDeleteSourcePreferenceProfile.mockResolvedValue({ success: true })
  })

  it('lists profiles for the current user', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, profiles: [] })
    expect(mockListSourcePreferenceProfiles).toHaveBeenCalledWith('user_123')
  })

  it('normalizes and saves a source preference profile', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/source-preference-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ' Climate Research ',
          description: 'Use primary climate science sources.',
          includeTerms: ['Climate', 'IPCC', 'climate']
        })
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpsertSourcePreferenceProfile).toHaveBeenCalledWith('user_123', {
      name: 'Climate Research',
      slug: 'climate-research',
      description: 'Use primary climate science sources.',
      settings: {
        includeTerms: ['climate', 'ipcc'],
        excludeTerms: []
      },
      isActive: true
    })
  })

  it('rejects profiles without usable topic terms', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/source-preference-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '!!!' })
      })
    )

    expect(response.status).toBe(400)
    expect(mockUpsertSourcePreferenceProfile).not.toHaveBeenCalled()
  })

  it('deletes only the current user profile id', async () => {
    const response = await DELETE(
      new Request(
        'http://localhost:3000/api/source-preference-profiles?id=profile_123',
        { method: 'DELETE' }
      )
    )

    expect(response.status).toBe(200)
    expect(mockDeleteSourcePreferenceProfile).toHaveBeenCalledWith(
      'user_123',
      'profile_123'
    )
  })
})
