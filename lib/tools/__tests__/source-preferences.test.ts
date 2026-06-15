import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserId = vi.fn()
const mockListSourcePreferenceProfiles = vi.fn()
const mockListSourcePreferences = vi.fn()
const mockUpsertSourcePreferenceProfile = vi.fn()
const mockUpsertSourcePreference = vi.fn()

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

vi.mock('@/lib/actions/source-preferences', () => ({
  listSourcePreferenceProfiles: (...args: unknown[]) =>
    mockListSourcePreferenceProfiles(...args),
  listSourcePreferences: (...args: unknown[]) =>
    mockListSourcePreferences(...args),
  upsertSourcePreferenceProfile: (...args: unknown[]) =>
    mockUpsertSourcePreferenceProfile(...args),
  upsertSourcePreference: (...args: unknown[]) =>
    mockUpsertSourcePreference(...args)
}))

import {
  createSourcePreferencesTool,
  sourcePreferencesToolSchema
} from '../source-preferences'

describe('source preferences tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a provider-compatible object input schema', () => {
    const parsed = sourcePreferencesToolSchema.safeParse({ action: 'list' })

    expect(parsed.success).toBe(true)
    expect(sourcePreferencesToolSchema.def.type).toBe('object')
  })

  it('rejects save calls without a target and preference before persistence', async () => {
    mockGetCurrentUserId.mockResolvedValue('user_123')

    const preferenceTool = createSourcePreferencesTool()

    await expect(
      preferenceTool.execute?.(
        { action: 'save' },
        { toolCallId: 'tool_123', messages: [] }
      )
    ).rejects.toThrow('Saving a source preference requires')
    expect(mockUpsertSourcePreference).not.toHaveBeenCalled()
  })

  it('persists a normalized source preference from chat language', async () => {
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockUpsertSourcePreference.mockResolvedValue({
      success: true,
      preference: {
        id: 'pref_123',
        domain: 'journal.example',
        preference: 'trust'
      }
    })

    const preferenceTool = createSourcePreferencesTool()
    const result = await preferenceTool.execute?.(
      {
        action: 'save',
        target: 'Journal.Example',
        preference: 'trust',
        note: 'Alice said to rely on this source more.'
      },
      { toolCallId: 'tool_123', messages: [] }
    )

    expect(mockUpsertSourcePreference).toHaveBeenCalledWith('user_123', {
      target: 'journal.example',
      targetType: 'domain',
      domain: 'journal.example',
      preference: 'trust',
      note: 'Alice said to rely on this source more.'
    })
    expect(result).toEqual({
      ok: true,
      action: 'save',
      preference: {
        id: 'pref_123',
        domain: 'journal.example',
        preference: 'trust'
      }
    })
  })

  it('lists remembered preferences for the current user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockListSourcePreferences.mockResolvedValue({
      success: true,
      preferences: [{ id: 'pref_123', domain: 'journal.example' }]
    })
    mockListSourcePreferenceProfiles.mockResolvedValue({
      success: true,
      profiles: [{ id: 'profile_123', name: 'Climate' }]
    })

    const preferenceTool = createSourcePreferencesTool()
    const result = await preferenceTool.execute?.(
      { action: 'list' },
      { toolCallId: 'tool_123', messages: [] }
    )

    expect(result).toEqual({
      ok: true,
      action: 'list',
      preferences: [{ id: 'pref_123', domain: 'journal.example' }],
      profiles: [{ id: 'profile_123', name: 'Climate' }]
    })
  })

  it('saves a source preference scoped to a named profile', async () => {
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockUpsertSourcePreferenceProfile.mockResolvedValue({
      success: true,
      profile: {
        id: 'profile_climate',
        name: 'Climate Research',
        slug: 'climate-research'
      },
      created: true
    })
    mockUpsertSourcePreference.mockResolvedValue({
      success: true,
      preference: {
        id: 'pref_ipcc',
        domain: 'ipcc.ch',
        preference: 'trust',
        profileId: 'profile_climate'
      }
    })

    const preferenceTool = createSourcePreferencesTool()
    const result = await preferenceTool.execute?.(
      {
        action: 'save',
        target: 'ipcc.ch',
        preference: 'trust',
        profileName: 'Climate Research',
        profileTerms: ['climate', 'ipcc']
      },
      { toolCallId: 'tool_123', messages: [] }
    )

    expect(mockUpsertSourcePreferenceProfile).toHaveBeenCalledWith('user_123', {
      name: 'Climate Research',
      slug: 'climate-research',
      settings: {
        includeTerms: ['climate', 'ipcc'],
        excludeTerms: []
      },
      isActive: true
    })
    expect(mockUpsertSourcePreference).toHaveBeenCalledWith('user_123', {
      target: 'ipcc.ch',
      targetType: 'domain',
      domain: 'ipcc.ch',
      preference: 'trust',
      profileId: 'profile_climate'
    })
    expect(result).toEqual({
      ok: true,
      action: 'save',
      preference: {
        id: 'pref_ipcc',
        domain: 'ipcc.ch',
        preference: 'trust',
        profileId: 'profile_climate'
      },
      profile: {
        id: 'profile_climate',
        name: 'Climate Research',
        slug: 'climate-research'
      }
    })
  })
})
