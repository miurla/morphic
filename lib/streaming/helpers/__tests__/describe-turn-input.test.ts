import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { describeTurnInput } from '@/lib/streaming/helpers/describe-turn-input'

function createParts(parts: unknown[]): UIMessage['parts'] {
  return parts as UIMessage['parts']
}

describe('describeTurnInput', () => {
  it('returns the typed text when there is any', () => {
    expect(
      describeTurnInput(createParts([{ type: 'text', text: 'hello' }]))
    ).toBe('hello')
  })

  it('prefers the text over the structured parts', () => {
    expect(
      describeTurnInput(
        createParts([
          {
            type: 'data-pastedContent',
            data: { text: 'a'.repeat(2000) }
          },
          { type: 'text', text: 'summarize this' }
        ])
      )
    ).toBe('summarize this')
  })

  it('describes a file part by name and media type', () => {
    expect(
      describeTurnInput(
        createParts([
          {
            type: 'file',
            filename: 'report.pdf',
            mediaType: 'application/pdf',
            url: 'https://example.com/report.pdf'
          }
        ])
      )
    ).toBe('"report.pdf" (application/pdf)')
  })

  it('describes pasted content by size without its content', () => {
    const description = describeTurnInput(
      createParts([
        { type: 'data-pastedContent', data: { text: 'secret'.repeat(100) } }
      ])
    )

    expect(description).toBe('pasted content (600 characters)')
    expect(description).not.toContain('secret')
  })

  it('describes quoted context by size', () => {
    expect(
      describeTurnInput(
        createParts([{ type: 'data-quotedContext', data: { text: 'quoted' } }])
      )
    ).toBe('quoted context (6 characters)')
  })

  it('describes a note by its neutralized title and size', () => {
    expect(
      describeTurnInput(
        createParts([
          {
            type: 'data-noteContext',
            data: { title: '<b>My\nnote</b>', text: 'body' }
          }
        ])
      )
    ).toBe('note "&lt;b&gt;My note&lt;/b&gt;" (4 characters)')
  })

  it('describes a note without a title', () => {
    expect(
      describeTurnInput(
        createParts([{ type: 'data-noteContext', data: { text: 'body' } }])
      )
    ).toBe('note (4 characters)')
  })

  it('keeps a source URL verbatim', () => {
    expect(
      describeTurnInput(
        createParts([
          { type: 'data-sourceUrl', data: { url: 'https://example.com/a' } }
        ])
      )
    ).toBe('URL card: https://example.com/a')
  })

  it('joins several structured parts in part order', () => {
    expect(
      describeTurnInput(
        createParts([
          {
            type: 'file',
            filename: 'notes.txt',
            mediaType: 'text/plain',
            url: 'https://example.com/notes.txt'
          },
          { type: 'data-pastedContent', data: { text: 'ab' } }
        ])
      )
    ).toBe('"notes.txt" (text/plain), pasted content (2 characters)')
  })

  it('returns undefined for a message with no parts', () => {
    expect(describeTurnInput(createParts([]))).toBeUndefined()
    expect(describeTurnInput(undefined)).toBeUndefined()
  })

  it('returns undefined for whitespace-only text', () => {
    expect(
      describeTurnInput(createParts([{ type: 'text', text: '   ' }]))
    ).toBeUndefined()
  })

  it('ignores structured parts that carry nothing', () => {
    expect(
      describeTurnInput(
        createParts([
          { type: 'data-pastedContent', data: { text: '' } },
          { type: 'data-sourceUrl', data: {} },
          { type: 'data-unknownKind', data: { text: 'x' } }
        ])
      )
    ).toBeUndefined()
  })
})
