import { describe, expect, it } from 'vitest'

import { extractReadableText, normalizeReaderRequest } from '../reader'

describe('reader source utilities', () => {
  it('normalizes explicit reader requests while preserving source metadata', () => {
    expect(
      normalizeReaderRequest({
        url: ' HTTPS://Example.com/article?utm_source=news#comments ',
        title: ' Example story ',
        siteName: ' Example News ',
        sourceId: ' source_123 '
      })
    ).toEqual({
      url: 'https://example.com/article',
      title: 'Example story',
      siteName: 'Example News',
      sourceId: 'source_123',
      domain: 'example.com'
    })
  })

  it('rejects unsafe or unsupported reader targets before fetching', () => {
    expect(normalizeReaderRequest({ url: 'file:///etc/passwd' })).toBeNull()
    expect(normalizeReaderRequest({ url: 'javascript:alert(1)' })).toBeNull()
    expect(normalizeReaderRequest({ url: '' })).toBeNull()
  })

  it('extracts readable text, removes active markup, and keeps source links attributed', () => {
    const readable = extractReadableText(
      `<!doctype html>
      <html>
        <head><title>Original title</title><style>body{}</style></head>
        <body>
          <nav>Skip this</nav>
          <article>
            <h1>Article headline</h1>
            <p>First paragraph with <a href="/source">source link</a>.</p>
            <script>alert("nope")</script>
            <p>Second paragraph.</p>
          </article>
        </body>
      </html>`,
      'https://example.com/story'
    )

    expect(readable.title).toBe('Article headline')
    expect(readable.content).toContain('First paragraph with source link.')
    expect(readable.content).toContain('Second paragraph.')
    expect(readable.content).not.toContain('alert')
    expect(readable.sourceUrl).toBe('https://example.com/story')
    expect(readable.domain).toBe('example.com')
  })
})
