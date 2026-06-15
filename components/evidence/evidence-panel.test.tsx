import React from 'react'

import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { ClaimVerificationResult } from '@/lib/claims/evidence-verification'

import { EvidencePanel } from './evidence-panel'

const checkedResult: ClaimVerificationResult = {
  status: 'checked',
  checkedAt: '2026-06-05T12:00:00.000Z',
  claims: [
    {
      id: 'claim-1',
      text: 'Morphic launched a Discovery page.',
      supportStatus: 'supported',
      confidence: 0.8,
      evidence: [
        {
          sourceId: 'source-1',
          sourceTitle: 'Launch report',
          sourceUrl: 'https://example.com/launch',
          quote: 'Morphic launched a Discovery page with source links.',
          supportType: 'supports',
          evidenceType: 'citation'
        }
      ]
    },
    {
      id: 'claim-2',
      text: 'Morphic added a weather radar dashboard.',
      supportStatus: 'unavailable',
      confidence: 0.1,
      evidence: []
    }
  ]
}

describe('EvidencePanel', () => {
  test('shows claim support states and source quotes', () => {
    render(<EvidencePanel result={checkedResult} />)

    expect(screen.getByText('Evidence checked')).toBeInTheDocument()
    expect(screen.getByText('1 issue')).toBeInTheDocument()

    const supportedClaim = screen.getByRole('article', {
      name: 'Morphic launched a Discovery page.'
    })
    expect(within(supportedClaim).getByText('Supported')).toBeInTheDocument()
    expect(
      within(supportedClaim).getByText(
        'Morphic launched a Discovery page with source links.'
      )
    ).toBeInTheDocument()
    expect(within(supportedClaim).getByText('Citation')).toBeInTheDocument()
    expect(
      within(supportedClaim).getByRole('link', { name: 'Launch report' })
    ).toHaveAttribute('href', 'https://example.com/launch')

    const unsupportedClaim = screen.getByRole('article', {
      name: 'Morphic added a weather radar dashboard.'
    })
    expect(
      within(unsupportedClaim).getByText('Unavailable')
    ).toBeInTheDocument()
  })

  test('does not block answer rendering when verification fails', () => {
    render(
      <EvidencePanel
        result={{
          status: 'failed',
          checkedAt: '2026-06-05T12:00:00.000Z',
          claims: [],
          error: 'Verifier input was invalid.'
        }}
      />
    )

    expect(screen.getByText('Evidence check unavailable')).toBeInTheDocument()
    expect(screen.getByText('Verifier input was invalid.')).toBeInTheDocument()
  })

  test('labels Google Fact Check review evidence separately from citations', () => {
    render(
      <EvidencePanel
        result={{
          status: 'checked',
          checkedAt: '2026-06-05T12:00:00.000Z',
          claims: [
            {
              id: 'claim-1',
              text: 'The Earth is flat.',
              supportStatus: 'contradicted',
              confidence: 0.95,
              evidence: [
                {
                  sourceTitle: 'Science Check: Is Earth flat?',
                  sourceUrl: 'https://sciencecheck.org/flat-earth',
                  quote: 'False',
                  supportType: 'contradicts',
                  evidenceType: 'fact_check_review'
                }
              ]
            }
          ]
        }}
      />
    )

    const claim = screen.getByRole('article', { name: 'The Earth is flat.' })
    expect(within(claim).getByText('Fact-check review')).toBeInTheDocument()
    expect(within(claim).getByText('False')).toBeInTheDocument()
  })
})
