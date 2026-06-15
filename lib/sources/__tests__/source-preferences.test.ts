import { describe, expect, it } from 'vitest'

import type { SearchResultItem } from '@/lib/types'

import {
  applySourcePreferencesToSearchResults,
  normalizeSourcePreferenceInput
} from '../source-preferences'

const results: SearchResultItem[] = [
  {
    title: 'Neutral result',
    url: 'https://neutral.example/report',
    content: 'A neutral source.'
  },
  {
    title: 'Muted result',
    url: 'https://noise.example/story',
    content: 'A source Alice wants to avoid.'
  },
  {
    title: 'Trusted result',
    url: 'https://journal.example/article',
    content: 'A source Alice trusts.'
  },
  {
    title: 'Blocked result',
    url: 'https://blocked.example/post',
    content: 'A source Alice never wants used.'
  }
]

describe('source preferences', () => {
  it('normalizes source preference targets without accepting unsafe protocols', () => {
    expect(
      normalizeSourcePreferenceInput({
        target: ' HTTPS://Journal.Example/articles?utm_source=x#section ',
        preference: 'trust',
        note: ' Use this for science '
      })
    ).toEqual({
      target: 'https://journal.example/articles',
      targetType: 'url',
      domain: 'journal.example',
      preference: 'trust',
      note: 'Use this for science'
    })

    expect(
      normalizeSourcePreferenceInput({
        target: 'Noise.Example',
        preference: 'mute'
      })
    ).toEqual({
      target: 'noise.example',
      targetType: 'domain',
      domain: 'noise.example',
      preference: 'mute'
    })

    expect(
      normalizeSourcePreferenceInput({
        target: 'javascript:alert(1)',
        preference: 'block'
      })
    ).toBeNull()
  })

  it('boosts trusted/preferred results, demotes muted results, and removes blocked results', () => {
    const ranked = applySourcePreferencesToSearchResults(results, [
      {
        id: 'pref_trust',
        domain: 'journal.example',
        preference: 'trust'
      },
      {
        id: 'pref_mute',
        domain: 'noise.example',
        preference: 'mute'
      },
      {
        id: 'pref_block',
        domain: 'blocked.example',
        preference: 'block'
      }
    ])

    expect(ranked.map(result => result.url)).toEqual([
      'https://journal.example/article',
      'https://neutral.example/report',
      'https://noise.example/story'
    ])
    expect(ranked[0].sourcePreference).toEqual({
      preference: 'trust',
      matchedBy: 'domain',
      matchedValue: 'journal.example'
    })
    expect(ranked[2].sourcePreference?.preference).toBe('mute')
  })
})
