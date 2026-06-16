import React from 'react'

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { AnswerSection } from '../answer-section'

vi.mock('@/components/spec-fence-block', () => ({
  SpecFenceBlock: ({ source }: { source: string }) => (
    <section>
      <h2>{source.includes('"Related"') ? 'Related' : 'Spec'}</h2>
    </section>
  )
}))

const citationMaps = {
  search_1: {
    1: {
      title: 'Launch report',
      url: 'https://example.com/launch',
      content:
        'Morphic launched a Discovery page with feed-derived story clusters.'
    }
  }
}

function renderAnswer() {
  return render(
    <AnswerSection
      content="Morphic launched a Discovery page. [1](#search_1)"
      isOpen
      onOpenChange={() => {}}
      messageId="message-1"
      citationMaps={citationMaps}
      showActions={false}
    />
  )
}

function renderAnswerWithFactCheck() {
  return render(
    <AnswerSection
      content="The Earth is flat."
      isOpen
      onOpenChange={() => {}}
      messageId="message-1"
      citationMaps={{}}
      factCheckResults={[
        {
          query: 'The Earth is flat.',
          claims: [
            {
              text: 'The Earth is flat.',
              claimReview: [
                {
                  publisher: { name: 'Science Check' },
                  url: 'https://sciencecheck.org/flat-earth',
                  textualRating: 'False'
                }
              ]
            }
          ]
        }
      ]}
      showActions={false}
    />
  )
}

describe('AnswerSection evidence verification', () => {
  afterEach(() => {
    delete process.env.ENABLE_CLAIM_VERIFICATION
  })

  test('does not render claim verification when the feature flag is disabled', () => {
    delete process.env.ENABLE_CLAIM_VERIFICATION

    renderAnswer()

    expect(screen.queryByText('Evidence checked')).toBeNull()
  })

  test('renders claim verification when the feature flag is enabled', () => {
    process.env.ENABLE_CLAIM_VERIFICATION = 'true'

    renderAnswer()

    expect(screen.getByText('Evidence checked')).toBeInTheDocument()
    expect(screen.getByText('Supported')).toBeInTheDocument()
  })

  test('renders Google Fact Check review evidence when available', () => {
    process.env.ENABLE_CLAIM_VERIFICATION = 'true'

    renderAnswerWithFactCheck()

    expect(screen.getByText('Evidence checked')).toBeInTheDocument()
    expect(screen.getByText('Contradicted')).toBeInTheDocument()
    expect(screen.getByText('Fact-check review')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
  })

  test('renders supporting source content before a trailing Related spec block', () => {
    const { container } = render(
      <AnswerSection
        content={[
          'Lagos is a coastal city in the Algarve.',
          '',
          '```spec',
          '{"op":"add","path":"/root","value":"main"}',
          '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{},"children":["header"]}}',
          '{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}',
          '```'
        ].join('\n')}
        isOpen
        onOpenChange={() => {}}
        messageId="message-1"
        citationMaps={{}}
        showActions={false}
        supportingContent={<div data-testid="supporting-sources">Sources</div>}
      />
    )

    expect(
      screen.getByText('Lagos is a coastal city in the Algarve.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('supporting-sources')).toBeInTheDocument()
    expect(screen.getByText('Related')).toBeInTheDocument()

    const order = Array.from(
      container.querySelectorAll('[data-testid="supporting-sources"], h2')
    ).map(node => node.textContent)
    expect(order).toEqual(['Sources', 'Related'])
  })
})
