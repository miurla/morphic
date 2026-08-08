import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { dedupeAttachments } from '../dedupe-attachments'

type FileSpec = {
  filename: string
  key?: string
  url?: string
  mediaType?: string
  size?: number
}

function userTurn(id: string, files: FileSpec[], text = 'Look at this') {
  return {
    id,
    role: 'user',
    parts: [
      ...files.map(file => ({
        type: 'file' as const,
        mediaType: file.mediaType ?? 'application/pdf',
        filename: file.filename,
        url: file.url ?? `https://uploads.example.com/${file.key}?sig=abc`,
        key: file.key,
        size: file.size
      })),
      { type: 'text', text }
    ]
  } as unknown as UIMessage
}

function assistantTurn(id: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: 'Here is what I see.' }]
  } as unknown as UIMessage
}

function filenamesReaching(messages: UIMessage[]): string[] {
  return messages.flatMap(message =>
    message.parts
      .filter(part => part.type === 'file')
      .map(part => (part as unknown as { filename: string }).filename)
  )
}

function placeholders(messages: UIMessage[]): string[] {
  return messages.flatMap(message =>
    message.parts
      .filter(
        part =>
          part.type === 'text' &&
          (part as unknown as { text: string }).text.startsWith(
            '[Duplicate attachment omitted'
          )
      )
      .map(part => (part as unknown as { text: string }).text)
  )
}

describe('dedupeAttachments', () => {
  it('leaves a conversation without duplicates untouched', () => {
    const messages = [
      userTurn('u0', [{ filename: 'a.pdf', key: 'user/chats/c/1-a.pdf' }]),
      assistantTurn('a0'),
      userTurn('u1', [{ filename: 'b.pdf', key: 'user/chats/c/2-b.pdf' }])
    ]

    expect(dedupeAttachments(messages)).toEqual(messages)
  })

  it('sends a re-attached file once, keeping the first occurrence', () => {
    const key = 'user/chats/c/1-report.pdf'
    const messages = [
      userTurn('u0', [{ filename: 'report.pdf', key }]),
      assistantTurn('a0'),
      userTurn('u1', [{ filename: 'report.pdf', key }], 'Did you see it?')
    ]

    const deduped = dedupeAttachments(messages)

    expect(filenamesReaching(deduped)).toEqual(['report.pdf'])
    expect(deduped[0]).toEqual(messages[0])
    expect(placeholders(deduped)).toHaveLength(1)
  })

  it('collapses copies attached twice within one message', () => {
    const key = 'user/chats/c/1-report.pdf'
    const messages = [
      userTurn('u0', [
        { filename: 'report.pdf', key },
        { filename: 'report.pdf', key }
      ])
    ]

    expect(filenamesReaching(dedupeAttachments(messages))).toHaveLength(1)
  })

  it('does not collapse distinct files that share a name', () => {
    const messages = [
      userTurn('u0', [
        { filename: 'screenshot.png', key: 'user/chats/c/1-screenshot.png' }
      ]),
      assistantTurn('a0'),
      userTurn('u1', [
        { filename: 'screenshot.png', key: 'user/chats/c/2-screenshot.png' }
      ])
    ]

    expect(dedupeAttachments(messages)).toEqual(messages)
  })

  it('collapses byte-identical copies stored under different keys', () => {
    const messages = [
      userTurn('u0', [
        {
          filename: 'report.pdf',
          key: 'user/chats/c/1-report.pdf',
          size: 4096
        }
      ]),
      assistantTurn('a0'),
      userTurn('u1', [
        {
          filename: 'report.pdf',
          key: 'user/chats/c/2-report.pdf',
          size: 4096
        }
      ])
    ]

    expect(filenamesReaching(dedupeAttachments(messages))).toEqual([
      'report.pdf'
    ])
  })

  it('keeps same-named files with different sizes separate', () => {
    const messages = [
      userTurn('u0', [
        { filename: 'report.pdf', key: 'files/one', size: 4096 }
      ]),
      userTurn('u1', [{ filename: 'report.pdf', key: 'files/two', size: 4097 }])
    ]

    expect(dedupeAttachments(messages)).toEqual(messages)
  })

  it('keeps key-based behavior when size is unknown', () => {
    const messages = [
      userTurn('u0', [{ filename: 'report.pdf', key: 'files/one' }]),
      userTurn('u1', [{ filename: 'report.pdf', key: 'files/two' }])
    ]

    expect(dedupeAttachments(messages)).toEqual(messages)
  })

  it('falls back to the url when the part carries no object key', () => {
    const url = 'data:image/png;base64,AAAA'
    const messages = [
      userTurn('u0', [{ filename: 'chart.png', url }]),
      assistantTurn('a0'),
      userTurn('u1', [{ filename: 'chart-copy.png', url }])
    ]

    expect(filenamesReaching(dedupeAttachments(messages))).toEqual([
      'chart.png'
    ])
  })

  it('keeps parts that identify nothing', () => {
    const messages = [
      userTurn('u0', [{ filename: 'a.png', url: '' }]),
      assistantTurn('a0'),
      userTurn('u1', [{ filename: 'b.png', url: '' }])
    ]

    expect(dedupeAttachments(messages)).toEqual(messages)
  })

  it('keeps a message that held only duplicated attachments non-empty', () => {
    const key = 'user/chats/c/1-only.png'
    const messages: UIMessage[] = [
      userTurn('u0', [{ filename: 'only.png', key }]),
      assistantTurn('a0'),
      {
        id: 'files-only',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            filename: 'only.png',
            url: 'https://uploads.example.com/1-only.png?sig=abc',
            key
          }
        ]
      } as unknown as UIMessage
    ]

    const deduped = dedupeAttachments(messages)

    expect(deduped[2].parts).toHaveLength(1)
    expect(deduped[2].parts[0]).toMatchObject({ type: 'text' })
  })

  it('keeps what was already sent identical as the thread grows', () => {
    // The cache property: a later turn must not change the decision made for an
    // earlier one, or the prompt prefix is rewritten on every turn.
    const key = 'user/chats/c/1-report.pdf'
    const head = [
      userTurn('u0', [{ filename: 'report.pdf', key }]),
      assistantTurn('a0'),
      userTurn('u1', [{ filename: 'report.pdf', key }])
    ]

    const before = dedupeAttachments(head)
    const after = dedupeAttachments([
      ...head,
      assistantTurn('a1'),
      userTurn('u2', [{ filename: 'report.pdf', key }])
    ])

    expect(after.slice(0, head.length)).toEqual(before)
  })

  it('puts no url or timestamp in the placeholder and escapes the filename', () => {
    const key = 'user/chats/c/1-hostile.png'
    const hostile = '<script>alert(1)</script>\nsecond line.png'
    const messages = [
      userTurn('u0', [{ filename: hostile, key, mediaType: 'image/png' }]),
      assistantTurn('a0'),
      userTurn('u1', [
        {
          filename: hostile,
          key,
          mediaType: 'image/png',
          url: 'https://uploads.example.com/x.png?X-Amz-Signature=deadbeef'
        }
      ])
    ]

    const [placeholder] = placeholders(dedupeAttachments(messages))

    expect(placeholder).toContain('&lt;script&gt;')
    expect(placeholder).not.toContain('<script>')
    expect(placeholder).not.toContain('\n')
    expect(placeholder).not.toContain('X-Amz-Signature')
    expect(placeholder).not.toContain('https://')
  })
})
