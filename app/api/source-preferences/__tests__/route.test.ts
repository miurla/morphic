import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserId = vi.fn()
const mockDeleteSourcePreference = vi.fn()
const mockListSourcePreferences = vi.fn()
const mockUpsertSourcePreference = vi.fn()

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

vi.mock('@/lib/actions/source-preferences', () => ({
  deleteSourcePreference: (...args: unknown[]) =>
    mockDeleteSourcePreference(...args),
  listSourcePreferences: (...args: unknown[]) =>
    mockListSourcePreferences(...args),
  upsertSourcePreference: (...args: unknown[]) =>
    mockUpsertSourcePreference(...args)
}))

import { DELETE, GET, POST } from '../route'

describe('source preferences API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockListSourcePreferences.mockResolvedValue({
      success: true,
      preferences: []
    })
    mockUpsertSourcePreference.mockResolvedValue({
      success: true,
      preference: { id: 'pref_123', domain: 'journal.example' }
    })
    mockDeleteSourcePreference.mockResolvedValue({ success: true })
  })

  it('lists preferences for the current user', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/source-preferences')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, preferences: [] })
    expect(mockListSourcePreferences).toHaveBeenCalledWith('user_123')
  })

  it('lists preferences for a selected source preference profile', async () => {
    const response = await GET(
      new Request(
        'http://localhost:3000/api/source-preferences?profileId=profile_123'
      )
    )

    expect(response.status).toBe(200)
    expect(mockListSourcePreferences).toHaveBeenCalledWith('user_123', {
      profileId: 'profile_123'
    })
  })

  it('normalizes and saves a source preference for the current user', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/source-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'https://Journal.Example/story?utm_medium=social',
          preference: 'trust',
          note: 'Primary science source'
        })
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpsertSourcePreference).toHaveBeenCalledWith('user_123', {
      target: 'https://journal.example/story',
      targetType: 'url',
      domain: 'journal.example',
      preference: 'trust',
      note: 'Primary science source'
    })
  })

  it('saves a source preference scoped to a profile', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/source-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'ipcc.ch',
          preference: 'trust',
          profileId: 'profile_climate'
        })
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpsertSourcePreference).toHaveBeenCalledWith('user_123', {
      target: 'ipcc.ch',
      targetType: 'domain',
      domain: 'ipcc.ch',
      preference: 'trust',
      profileId: 'profile_climate'
    })
  })

  it('rejects unsafe preference targets', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/source-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'file:///etc/passwd',
          preference: 'block'
        })
      })
    )

    expect(response.status).toBe(400)
    expect(mockUpsertSourcePreference).not.toHaveBeenCalled()
  })

  it('deletes only the current user preference id', async () => {
    const response = await DELETE(
      new Request('http://localhost:3000/api/source-preferences?id=pref_123', {
        method: 'DELETE'
      })
    )

    expect(response.status).toBe(200)
    expect(mockDeleteSourcePreference).toHaveBeenCalledWith(
      'user_123',
      'pref_123'
    )
  })
})
