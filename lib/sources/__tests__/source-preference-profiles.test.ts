import { describe, expect, it } from 'vitest'

import {
  getEffectiveSourcePreferencesForQuery,
  normalizeSourcePreferenceProfileInput,
  selectSourcePreferenceProfileForQuery
} from '../source-preference-profiles'

describe('source preference profiles', () => {
  it('normalizes topic terms for a profile', () => {
    expect(
      normalizeSourcePreferenceProfileInput({
        name: 'Climate Research',
        description: 'Use primary climate science sources.',
        includeTerms: [' climate ', 'IPCC', 'climate']
      })
    ).toEqual({
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

  it('selects the active profile that best matches the query', () => {
    const profile = selectSourcePreferenceProfileForQuery(
      'What does the latest IPCC report say about climate attribution?',
      [
        {
          id: 'profile_health',
          name: 'Health',
          slug: 'health',
          settings: { includeTerms: ['nutrition'], excludeTerms: [] },
          isActive: true
        },
        {
          id: 'profile_climate',
          name: 'Climate',
          slug: 'climate',
          settings: { includeTerms: ['climate', 'ipcc'], excludeTerms: [] },
          isActive: true
        }
      ]
    )

    expect(profile?.id).toBe('profile_climate')
  })

  it('combines global preferences with the matched profile preferences only', () => {
    const preferences = getEffectiveSourcePreferencesForQuery(
      [
        {
          id: 'pref_global',
          domain: 'always.example',
          target: 'always.example',
          targetType: 'domain',
          preference: 'prefer',
          profileId: null
        },
        {
          id: 'pref_climate',
          domain: 'ipcc.ch',
          target: 'ipcc.ch',
          targetType: 'domain',
          preference: 'trust',
          profileId: 'profile_climate'
        },
        {
          id: 'pref_health',
          domain: 'nih.gov',
          target: 'nih.gov',
          targetType: 'domain',
          preference: 'trust',
          profileId: 'profile_health'
        }
      ],
      [
        {
          id: 'profile_climate',
          name: 'Climate',
          slug: 'climate',
          settings: { includeTerms: ['climate'], excludeTerms: [] },
          isActive: true
        },
        {
          id: 'profile_health',
          name: 'Health',
          slug: 'health',
          settings: { includeTerms: ['health'], excludeTerms: [] },
          isActive: true
        }
      ],
      'climate impacts'
    )

    expect(preferences.map(preference => preference.id)).toEqual([
      'pref_global',
      'pref_climate'
    ])
  })
})
