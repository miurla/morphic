import { describe, expect, test } from 'vitest'

import { collectFactCheckResultsFromMessageParts } from './fact-check-results'

describe('fact-check result collection', () => {
  test('collects completed Google Fact Check tool outputs from message parts', () => {
    const results = collectFactCheckResultsFromMessageParts([
      {
        type: 'tool-googleFactCheck',
        state: 'output-available',
        toolCallId: 'fact-1',
        input: { query: 'earth flat' },
        output: {
          state: 'complete',
          query: 'earth flat',
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
      },
      {
        type: 'tool-googleFactCheck',
        state: 'input-available',
        input: { query: 'unfinished' }
      },
      {
        type: 'dynamic-tool',
        toolName: 'googleFactCheck',
        state: 'output-available',
        output: {
          state: 'complete',
          query: 'water boiling',
          claims: []
        }
      }
    ] as any[])

    expect(results).toEqual([
      {
        query: 'earth flat',
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
      },
      {
        query: 'water boiling',
        claims: []
      }
    ])
  })
})
