import type { Spec } from '@json-render/core'
import { describe, expect, test } from 'vitest'

import { prepareRevisionSuggestions } from '../revise-suggestions'

const button = {
  type: 'Button',
  props: { text: 'PRIVATE LABEL' },
  on: {
    press: {
      action: 'submitRevision',
      params: { query: 'PRIVATE QUERY', intent: 'alternatives' }
    }
  }
}

describe('revision spec preparation', () => {
  test('ignores orphan elements and cycles, uses app-owned ids, and leaves the source unchanged', () => {
    const spec: Spec = {
      root: 'root',
      elements: {
        root: {
          type: 'Stack',
          props: {},
          children: ['heading', 'PRIVATE ELEMENT ID', 'root']
        },
        heading: { type: 'Heading', props: { title: 'Revise' } },
        'PRIVATE ELEMENT ID': button,
        orphan: button
      }
    }
    const original = JSON.stringify(spec)
    const result = prepareRevisionSuggestions(spec)
    expect(result.suggestions).toEqual([
      {
        suggestionId: 'revise-1',
        position: 0,
        intent: 'alternatives',
        query: 'PRIVATE QUERY'
      }
    ])
    expect(result.spec.elements['PRIVATE ELEMENT ID'].on?.press).toEqual({
      action: 'submitRevision',
      params: { position: 0 }
    })
    expect(JSON.stringify(spec)).toBe(original)
  })

  test('does not classify legacy Related or invalid revision intents as Revise', () => {
    const spec: Spec = {
      root: 'root',
      elements: {
        root: { type: 'Stack', props: {}, children: ['heading', 'button'] },
        heading: { type: 'Heading', props: { title: 'Related' } },
        button: {
          ...button,
          on: {
            press: { action: 'submitQuery', params: { query: 'Related query' } }
          }
        }
      }
    }
    expect(prepareRevisionSuggestions(spec).suggestions).toEqual([])
    spec.elements.heading.props.title = 'Revise'
    spec.elements.button = {
      ...button,
      on: {
        press: {
          action: 'submitRevision',
          params: { query: 'x', intent: 'invalid' }
        }
      }
    }
    expect(prepareRevisionSuggestions(spec).suggestions).toEqual([])
    expect(
      prepareRevisionSuggestions({ root: '', elements: {} }).suggestions
    ).toEqual([])
  })
})
