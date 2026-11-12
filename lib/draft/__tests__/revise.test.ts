import { describe, expect, test } from 'vitest'

import { createDraftTools } from '@/lib/tools/draft'

import { buildDraftVersions, currentDraftVersion } from '../draft'
import { getDraftPrompt } from '../prompt'
import {
  isReviseAlternativesTurn,
  markRevisionQuery,
  reviseQuery,
  revisionIntentFromQuery
} from '../revise'

const initial = {
  id: 'a1',
  role: 'assistant',
  parts: [
    {
      type: 'text',
      text: '````draft\ntitle: T\n\nOpening\n\nEnding\n\nFAQ\n````'
    }
  ]
}
const preview = {
  id: 'u2',
  role: 'user',
  parts: [
    {
      type: 'text',
      text: reviseQuery(
        'Show three endings, preserve opening and FAQ',
        'alternatives'
      )
    }
  ]
}

describe('revision draft safety', () => {
  test('ignores both unexpected draft blocks and edit calls in candidate responses', () => {
    const versions = buildDraftVersions([
      initial,
      preview,
      {
        id: 'a2',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '````draft\ntitle: Wrong\n\nChanged everything\n````'
          },
          {
            type: 'tool-editDraft',
            state: 'output-available',
            input: { edits: [{ find: 'Opening', replace: 'Wrong' }] },
            output: { applied: 1 }
          }
        ]
      }
    ])
    expect(versions).toHaveLength(1)
    expect(currentDraftVersion(versions)?.content).toBe(
      'Opening\n\nEnding\n\nFAQ'
    )
  })

  test('applies a selected ending on a later explicit user request and preserves other sections', () => {
    const versions = buildDraftVersions([
      initial,
      preview,
      {
        id: 'a2',
        role: 'assistant',
        parts: [{ type: 'text', text: '1. New ending' }]
      },
      {
        id: 'u3',
        role: 'user',
        parts: [{ type: 'text', text: 'Apply option 1 to the ending only' }]
      },
      {
        id: 'a3',
        role: 'assistant',
        parts: [
          {
            type: 'tool-editDraft',
            state: 'output-available',
            input: { edits: [{ find: 'Ending', replace: 'New ending' }] },
            output: { applied: 1 }
          }
        ]
      }
    ])
    expect(currentDraftVersion(versions)?.content).toBe(
      'Opening\n\nNew ending\n\nFAQ'
    )
  })

  test('rejects a tool mutation on preview turns', async () => {
    const draft = currentDraftVersion(buildDraftVersions([initial]))
    const tools = createDraftTools(draft, true)
    const output = await tools.editDraft.execute!(
      { edits: [{ find: 'Ending', replace: 'Wrong' }] },
      { toolCallId: 'call', messages: [], context: {} }
    )
    expect(output).toMatchObject({ applied: 0 })
  })

  test('detects only exact query prefixes and strips transport markers before sending', () => {
    for (const intent of ['alternatives', 'edit'] as const) {
      const query = markRevisionQuery('Ending only', intent)
      expect(revisionIntentFromQuery(query)).toBe(intent)
      const sent = reviseQuery(query, intent)
      expect(sent).not.toContain('[revise:')
      expect(sent).toContain('Ending only')
      expect(
        isReviseAlternativesTurn({
          role: 'user',
          parts: [{ type: 'text', text: sent }]
        })
      ).toBe(intent === 'alternatives')
    }
    expect(revisionIntentFromQuery('Show alternatives in chat')).toBeUndefined()
    expect(
      revisionIntentFromQuery('[revise:alternatives] no newline')
    ).toBeUndefined()
    expect(
      revisionIntentFromQuery('Quoted: [revise:edit]\nEnding')
    ).toBeUndefined()
  })

  test('recognizes only preview requests, retaining draft and prompt constraints', () => {
    expect(isReviseAlternativesTurn(preview)).toBe(true)
    expect(isReviseAlternativesTurn({ ...preview, role: 'assistant' })).toBe(
      false
    )
    expect(
      isReviseAlternativesTurn({
        ...preview,
        parts: [{ type: 'text', text: reviseQuery('Rewrite ending', 'edit') }]
      })
    ).toBe(false)
    expect(getDraftPrompt()).toContain(
      'never call editDraft or emit a draft block'
    )
    expect(reviseQuery('末尾だけ', 'edit')).toContain(
      'word count, structure, FAQ'
    )
  })
})
