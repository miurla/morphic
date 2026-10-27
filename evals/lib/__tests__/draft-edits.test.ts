import { describe, expect, test } from 'vitest'

import { prepareDraftTurn } from '../../tasks/draft-turn'
import { analyzeDraftTurn, loadDraftEditsDataset } from '../draft-edits'

const BLOCK = [
  'Wrote it.',
  '',
  '````draft',
  'title: T',
  '',
  'Body',
  '````'
].join('\n')
const EDIT = { input: { title: 'Renamed' }, applied: 1 }

describe('analyzeDraftTurn', () => {
  test('an unrelated answer is correct only without an editDraft call', () => {
    expect(
      analyzeDraftTurn({ text: 'Here you go.', editCalls: [] }, 'unrelated')
        .correct
    ).toBe(true)
    expect(
      analyzeDraftTurn({ text: 'Renamed.', editCalls: [EDIT] }, 'unrelated')
        .correct
    ).toBe(false)
  })

  test('a rejected edit still counts as touching the draft', () => {
    const analysis = analyzeDraftTurn(
      { text: '', editCalls: [{ input: {}, applied: 0 }] },
      'unrelated'
    )
    expect(analysis.calledEdit).toBe(true)
    expect(analysis.changedDraft).toBe(false)
  })

  test('a new piece needs a new block and no edit', () => {
    expect(
      analyzeDraftTurn({ text: BLOCK, editCalls: [] }, 'new').correct
    ).toBe(true)
    expect(
      analyzeDraftTurn({ text: 'Updated.', editCalls: [EDIT] }, 'new').correct
    ).toBe(false)
    expect(
      analyzeDraftTurn({ text: BLOCK, editCalls: [EDIT] }, 'new').correct
    ).toBe(false)
  })

  test('a change request accepts an applied edit or a rewrite', () => {
    expect(
      analyzeDraftTurn({ text: 'Updated.', editCalls: [EDIT] }, 'edit').correct
    ).toBe(true)
    expect(
      analyzeDraftTurn({ text: BLOCK, editCalls: [] }, 'edit').correct
    ).toBe(true)
    expect(
      analyzeDraftTurn(
        { text: 'Tried.', editCalls: [{ input: {}, applied: 0 }] },
        'edit'
      ).correct
    ).toBe(false)
  })

  test('an unclosed block is not a written draft', () => {
    const open = '````draft\ntitle: T\n\nBody'
    expect(
      analyzeDraftTurn({ text: open, editCalls: [] }, 'new').wroteBlock
    ).toBe(false)
  })
})

describe('synthetic draft-edits dataset', () => {
  const items = loadDraftEditsDataset({
    seedsPath: '/nonexistent',
    includeSynthetic: true
  })

  test('covers every category', () => {
    const categories = new Set(items.map(item => item.metadata.category))
    expect([...categories].sort()).toEqual(['edit', 'new', 'unrelated'])
  })

  test('every item reaches the model with its draft attached', () => {
    for (const item of items) {
      const prepared = prepareDraftTurn(item.input.messages)
      expect(prepared.currentDraft).not.toBeNull()
      const last = prepared.messages.at(-1)!
      const attached = last.parts.at(-1)
      expect(attached?.type === 'text' && attached.text).toContain(
        '<current_draft'
      )
    }
  })
})
