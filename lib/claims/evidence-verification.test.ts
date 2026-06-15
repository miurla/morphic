import { describe, expect, test } from 'vitest'

import type { SearchResultItem } from '@/lib/types'

import { verifyAnswerClaims } from './evidence-verification'

const citationMaps: Record<string, Record<number, SearchResultItem>> = {
  search_1: {
    1: {
      title: 'Launch report',
      url: 'https://example.com/launch',
      content:
        'Morphic launched a Discovery page with feed-derived story clusters and source links.'
    },
    2: {
      title: 'Safety report',
      url: 'https://example.com/safety',
      content: 'The release did not enable autonomous publishing.'
    }
  }
}

describe('claim evidence verification', () => {
  test('marks cited claims as supported when source snippets contain the claim terms', () => {
    const result = verifyAnswerClaims({
      answer:
        'Morphic launched a Discovery page with feed-derived story clusters. [1](#search_1)',
      citationMaps
    })

    expect(result.status).toBe('checked')
    expect(result.claims[0]).toMatchObject({
      text: 'Morphic launched a Discovery page with feed-derived story clusters.',
      supportStatus: 'supported'
    })
    expect(result.claims[0].evidence[0]).toMatchObject({
      sourceUrl: 'https://example.com/launch',
      supportType: 'supports'
    })
  })

  test('flags cited claims as unavailable when snippets do not support them', () => {
    const result = verifyAnswerClaims({
      answer: 'Morphic added a weather radar dashboard. [1](#search_1)',
      citationMaps
    })

    expect(result.claims[0]).toMatchObject({
      supportStatus: 'unavailable'
    })
  })

  test('flags contradicted claims when cited evidence negates the claim', () => {
    const result = verifyAnswerClaims({
      answer: 'The release enabled autonomous publishing. [2](#search_1)',
      citationMaps
    })

    expect(result.claims[0]).toMatchObject({
      supportStatus: 'contradicted'
    })
    expect(result.claims[0].evidence[0]).toMatchObject({
      supportType: 'contradicts'
    })
  })

  test('flags factual-looking claims without citations as uncited', () => {
    const result = verifyAnswerClaims({
      answer: 'Morphic launched a Discovery page.',
      citationMaps
    })

    expect(result.claims[0]).toMatchObject({
      supportStatus: 'uncited',
      evidence: []
    })
  })

  test('uses Google Fact Check reviews as contradiction evidence', () => {
    const result = verifyAnswerClaims({
      answer: 'The Earth is flat.',
      citationMaps: {},
      factCheckResults: [
        {
          query: 'The Earth is flat.',
          claims: [
            {
              text: 'The Earth is flat.',
              claimant: 'Flat Earth Society',
              claimReview: [
                {
                  publisher: {
                    name: 'Science Check',
                    site: 'sciencecheck.org'
                  },
                  url: 'https://sciencecheck.org/flat-earth',
                  title: 'Is Earth flat?',
                  textualRating: 'False',
                  reviewDate: '2026-02-01'
                }
              ]
            }
          ]
        }
      ]
    })

    expect(result.claims[0]).toMatchObject({
      supportStatus: 'contradicted'
    })
    expect(result.claims[0].evidence[0]).toMatchObject({
      sourceTitle: 'Science Check: Is Earth flat?',
      sourceUrl: 'https://sciencecheck.org/flat-earth',
      quote: 'False',
      supportType: 'contradicts',
      evidenceType: 'fact_check_review'
    })
  })

  test('uses Google Fact Check true ratings as support evidence', () => {
    const result = verifyAnswerClaims({
      answer: 'Water boils at 100 degrees Celsius at sea level.',
      citationMaps: {},
      factCheckResults: [
        {
          query: 'Water boils at 100 degrees Celsius at sea level.',
          claims: [
            {
              text: 'Water boils at 100 degrees Celsius at sea level.',
              claimReview: [
                {
                  publisher: {
                    name: 'Science Check'
                  },
                  url: 'https://sciencecheck.org/water-boiling',
                  textualRating: 'True'
                }
              ]
            }
          ]
        }
      ]
    })

    expect(result.claims[0]).toMatchObject({
      supportStatus: 'supported'
    })
    expect(result.claims[0].evidence[0]).toMatchObject({
      supportType: 'supports',
      evidenceType: 'fact_check_review'
    })
  })

  test('returns a non-blocking failure result for malformed verifier input', () => {
    const result = verifyAnswerClaims({
      answer: null as unknown as string,
      citationMaps
    })

    expect(result).toMatchObject({
      status: 'failed',
      claims: []
    })
  })
})
