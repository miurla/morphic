import { describe, expect, test } from 'vitest'

import {
  applyDraftEdits,
  buildDraftVersions,
  compactDraftBlocks,
  formatCurrentDraft,
  parseDraftBlocks,
  parseDraftFenceBody
} from '../draft'

const BLOCK = [
  'Here is your draft.',
  '',
  '````draft',
  'title: Cutting boards',
  '',
  '# Cutting boards',
  '',
  '```text',
  'oil monthly',
  '```',
  '',
  'End.',
  '````',
  '',
  'Want changes?'
].join('\n')

describe('parseDraftBlocks', () => {
  test('reads title and content, keeping inner code fences', () => {
    const [block] = parseDraftBlocks(BLOCK)
    expect(block.closed).toBe(true)
    expect(block.title).toBe('Cutting boards')
    expect(block.content).toContain('```text\noil monthly\n```')
    expect(block.content.endsWith('End.')).toBe(true)
  })

  test('reports a streaming block as open', () => {
    const [block] = parseDraftBlocks(
      'Intro\n\n````draft\ntitle: X\n\n# Partial'
    )
    expect(block).toEqual({ title: 'X', content: '# Partial', closed: false })
  })

  test('returns nothing for text without a draft', () => {
    expect(parseDraftBlocks('```ts\nconst a = 1\n```')).toEqual([])
  })
})

describe('applyDraftEdits', () => {
  test('applies unique edits in order', () => {
    const result = applyDraftEdits('alpha beta gamma', [
      { find: 'beta', replace: 'BETA' },
      { find: 'gamma', replace: 'delta' }
    ])
    expect(result).toEqual({
      content: 'alpha BETA delta',
      applied: 2,
      failed: []
    })
  })

  test('skips missing and ambiguous finds', () => {
    const result = applyDraftEdits('a b a', [
      { find: 'a', replace: 'x' },
      { find: 'zzz', replace: 'y' },
      { find: 'b', replace: 'B' }
    ])
    expect(result.content).toBe('a B a')
    expect(result.failed.map(f => f.reason)).toEqual([
      'not unique',
      'not found'
    ])
  })
})

describe('buildDraftVersions', () => {
  test('tracks writes and completed edits across messages', () => {
    const versions = buildDraftVersions([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'write it' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: BLOCK }] },
      {
        id: 'a2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-editDraft',
            state: 'output-available',
            input: { edits: [{ find: 'End.', replace: 'The end.' }] },
            output: {}
          },
          {
            type: 'tool-editDraft',
            state: 'input-streaming',
            input: { edits: [{ find: 'The end.', replace: 'ignored' }] }
          }
        ]
      }
    ])

    expect(versions.map(v => [v.version, v.kind])).toEqual([
      [1, 'write'],
      [2, 'edit']
    ])
    expect(versions[1].content.endsWith('The end.')).toBe(true)
    expect(versions[1].title).toBe('Cutting boards')
  })

  test('keeps a block an answer stopped inside as an interrupted version', () => {
    const versions = buildDraftVersions([
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'text', text: '````draft\ntitle: Note\n\nHalf a sent' }]
      }
    ])
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      content: 'Half a sent',
      interrupted: true
    })
  })

  test('skips an edit the tool rejected', () => {
    const versions = buildDraftVersions([
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: BLOCK }] },
      {
        id: 'a2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-editDraft',
            state: 'output-available',
            input: { edits: [{ find: 'End.', replace: 'The end.' }] },
            output: { applied: 0, failed: [] }
          }
        ]
      }
    ])
    expect(versions).toHaveLength(1)
  })

  test('skips an edit after a block written in the same answer', () => {
    const versions = buildDraftVersions([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'text', text: BLOCK },
          {
            type: 'tool-editDraft',
            state: 'output-available',
            input: { edits: [{ find: 'End.', replace: 'The end.' }] },
            output: { applied: 1, failed: [] }
          }
        ]
      }
    ])
    expect(versions.map(v => v.kind)).toEqual(['write'])
  })

  test('ignores an edit before any draft exists', () => {
    expect(
      buildDraftVersions([
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-editDraft',
              state: 'output-available',
              input: { edits: [{ find: 'x', replace: 'y' }] }
            }
          ]
        }
      ])
    ).toEqual([])
  })
})

describe('compactDraftBlocks', () => {
  test('stubs a block an answer stopped inside', () => {
    const out = compactDraftBlocks('Here.\n\n````draft\ntitle: Note\n\nHalf')
    expect(out).toBe(
      'Here.\n\n[Draft "Note" written here (4 characters). The current version is attached to the latest user message.]'
    )
  })

  test('replaces closed blocks with a stub and keeps the rest', () => {
    const out = compactDraftBlocks(BLOCK)
    expect(out).not.toContain('````draft')
    expect(out).toContain('[Draft "Cutting boards" written here')
    expect(out.startsWith('Here is your draft.')).toBe(true)
    expect(out.endsWith('Want changes?')).toBe(true)
  })

  test('leaves text without a draft untouched', () => {
    const text = 'Plain answer.'
    expect(compactDraftBlocks(text)).toBe(text)
  })
})

describe('formatCurrentDraft', () => {
  test('wraps the content with title and version', () => {
    const text = formatCurrentDraft({
      version: 2,
      title: 'A "quoted" title',
      content: 'Body',
      kind: 'edit',
      messageId: 'a1'
    })
    expect(text).toBe(
      `<current_draft title="A 'quoted' title" version="2">\nBody\n</current_draft>`
    )
  })
})

describe('three-backtick close', () => {
  test('closes a block whose close has three backticks', () => {
    const text = '````draft\ntitle: T\n\nBody\n```\n\nAfter.'
    const [block] = parseDraftBlocks(text)
    expect(block).toEqual({ title: 'T', content: 'Body', closed: true })
  })

  test('keeps inner code fences and closes on the unpaired one', () => {
    const text = [
      '````draft',
      'title: T',
      '',
      'Intro',
      '```ts',
      'const a = 1',
      '```',
      'Outro',
      '```'
    ].join('\n')
    const [block] = parseDraftBlocks(text)
    expect(block.closed).toBe(true)
    expect(block.content).toBe('Intro\n```ts\nconst a = 1\n```\nOutro')
  })

  test('stays open while an inner code fence is only paired so far', () => {
    const text = '````draft\ntitle: T\n\nIntro\n```ts\ncode\n```\nmore'
    expect(parseDraftBlocks(text)[0].closed).toBe(false)
  })

  test('compacts and versions a block closed with three backticks', () => {
    const text = 'Here.\n\n````draft\ntitle: T\n\nBody\n```'
    expect(compactDraftBlocks(text)).toBe(
      'Here.\n\n[Draft "T" written here (4 characters). The current version is attached to the latest user message.]'
    )
    expect(
      buildDraftVersions([
        { id: 'a', role: 'assistant', parts: [{ type: 'text', text }] }
      ])
    ).toHaveLength(1)
  })
})

describe('parseDraftFenceBody', () => {
  test('drops a stray three-backtick close and the text after it', () => {
    expect(
      parseDraftFenceBody('title: T\n\nBody\n```\n\nWant changes?\n')
    ).toEqual({ title: 'T', content: 'Body' })
  })

  test('reads a normal fence body', () => {
    expect(parseDraftFenceBody('title: T\n\nBody\n')).toEqual({
      title: 'T',
      content: 'Body'
    })
  })
})
