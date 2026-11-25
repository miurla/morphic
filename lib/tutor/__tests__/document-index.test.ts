import { describe, expect, it } from 'vitest'

import { buildDocumentIndexKey } from '../document-index'

describe('Tutor document index identity', () => {
  it('preserves existing PDF index identities', () => {
    expect(buildDocumentIndexKey('parser-v1', 'embedding-v1')).toBe(
      'parser-v1:embedding-v1'
    )
    expect(
      buildDocumentIndexKey('parser-v1', 'embedding-v1', 'notes.PDF')
    ).toBe('parser-v1:embedding-v1')
  })

  it('separates parsing formats when uploaded bytes match', () => {
    const keys = ['notes.pdf', 'notes.txt', 'notes.md', 'notes.docx'].map(
      name => buildDocumentIndexKey('parser-v1', 'embedding-v1', name)
    )
    expect(new Set(keys).size).toBe(4)
    expect(
      buildDocumentIndexKey('parser-v1', 'embedding-v1', 'notes.markdown')
    ).toBe(keys[2])
    expect(
      buildDocumentIndexKey('parser-v1', 'embedding-v1', 'renamed.MD')
    ).toBe(keys[2])
  })

  it('invalidates text indexes when parser or embedding settings change', () => {
    const original = buildDocumentIndexKey(
      'parser-v1',
      'embedding-v1',
      'notes.txt'
    )
    expect(
      buildDocumentIndexKey('parser-v2', 'embedding-v1', 'notes.txt')
    ).not.toBe(original)
    expect(
      buildDocumentIndexKey('parser-v1', 'embedding-v2', 'notes.txt')
    ).not.toBe(original)
  })
})
