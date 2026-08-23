import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  capHistoricalAttachments,
  parseAttachmentTokenBudget,
  parseReplayLimit
} from '../cap-historical-attachments'

const LIMIT = 10

function userTurn(
  id: string,
  fileCount: number,
  text = 'Look at this'
): UIMessage {
  const files = Array.from({ length: fileCount }, (_, i) => ({
    type: 'file' as const,
    mediaType: 'image/png',
    filename: `${id}-${i}.png`,
    url: `https://uploads.example.com/${id}-${i}.png?sig=abc`
  }))

  return {
    id,
    role: 'user',
    parts: [...files, { type: 'text', text }]
  } as unknown as UIMessage
}

function assistantTurn(id: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: 'Here is what I see.' }]
  } as unknown as UIMessage
}

/** One user turn carrying `perTurn` files, followed by an assistant reply. */
function thread(turns: number, perTurn: number): UIMessage[] {
  return Array.from({ length: turns }, (_, i) => [
    userTurn(`u${i}`, perTurn),
    assistantTurn(`a${i}`)
  ]).flat()
}

function pdfThread(turns: number, size = 500_000): UIMessage[] {
  return thread(turns, 0).map(message => {
    if (message.role !== 'user') return message

    return {
      ...message,
      parts: [
        {
          type: 'file',
          mediaType: 'application/pdf',
          filename: `${message.id}.pdf`,
          url: `https://example.com/${message.id}.pdf`,
          size
        },
        ...message.parts
      ]
    } as unknown as UIMessage
  })
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
            '[Attachment omitted'
          )
      )
      .map(part => (part as unknown as { text: string }).text)
  )
}

describe('capHistoricalAttachments', () => {
  it('leaves a conversation under the limit untouched', () => {
    const messages = thread(5, 1).concat(userTurn('current', 1))

    expect(capHistoricalAttachments(messages, LIMIT)).toEqual(messages)
  })

  it('leaves attachments alone until a whole block can be dropped', () => {
    // 19 in history is over the limit, but not yet a full block, so dropping
    // any of them would move the boundary again next turn.
    const messages = thread(19, 1).concat(userTurn('current', 0))

    expect(capHistoricalAttachments(messages, LIMIT)).toEqual(messages)
  })

  it('drops the oldest block once history crosses it', () => {
    const messages = thread(20, 1).concat(userTurn('current', 0))
    const capped = capHistoricalAttachments(messages, LIMIT)

    const kept = filenamesReaching(capped)
    expect(kept).toHaveLength(LIMIT)
    expect(kept[0]).toBe('u10-0.png')
    expect(kept.at(-1)).toBe('u19-0.png')
    expect(placeholders(capped)).toHaveLength(LIMIT)
  })

  it('keeps the dropped set identical while inside the same block', () => {
    // The cache property: appending turns must not change what was already
    // sent, or the prompt prefix is rewritten on every turn.
    const at20 = capHistoricalAttachments(
      thread(20, 1).concat(userTurn('current', 0)),
      LIMIT
    )
    const at25 = capHistoricalAttachments(
      thread(25, 1).concat(userTurn('current', 0)),
      LIMIT
    )

    const prefixLength = at20.length - 1
    expect(at25.slice(0, prefixLength)).toEqual(at20.slice(0, prefixLength))
  })

  it('advances the boundary by exactly one block on the next crossing', () => {
    const capped = capHistoricalAttachments(
      thread(30, 1).concat(userTurn('current', 0)),
      LIMIT
    )

    expect(placeholders(capped)).toHaveLength(2 * LIMIT)
    expect(filenamesReaching(capped)[0]).toBe('u20-0.png')
  })

  it('never keeps more than two blocks regardless of history size', () => {
    for (const turns of [21, 47, 70, 200]) {
      const kept = filenamesReaching(
        capHistoricalAttachments(
          thread(turns, 1).concat(userTurn('current', 0)),
          LIMIT
        )
      )
      expect(kept.length).toBeGreaterThanOrEqual(LIMIT)
      expect(kept.length).toBeLessThan(2 * LIMIT)
    }
  })

  it('never caps the newest user message', () => {
    const messages = thread(30, 1).concat(userTurn('current', 4))
    const capped = capHistoricalAttachments(messages, LIMIT)

    expect(capped.at(-1)).toEqual(messages.at(-1))
    expect(
      filenamesReaching(capped).filter(n => n.startsWith('current'))
    ).toHaveLength(4)
  })

  it('keeps a message that held only attachments non-empty', () => {
    const messages: UIMessage[] = [
      {
        id: 'files-only',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            filename: 'only.png',
            url: 'https://uploads.example.com/only.png'
          }
        ]
      } as unknown as UIMessage,
      assistantTurn('a0'),
      ...thread(20, 1),
      userTurn('current', 0)
    ]

    const capped = capHistoricalAttachments(messages, LIMIT)

    expect(capped[0].parts).toHaveLength(1)
    expect(capped[0].parts[0]).toMatchObject({ type: 'text' })
  })

  it('puts no url or timestamp in the placeholder and escapes the filename', () => {
    const messages: UIMessage[] = [
      {
        id: 'hostile',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            filename: '<script>alert(1)</script>\nsecond line.png',
            url: 'https://uploads.example.com/x.png?X-Amz-Signature=deadbeef'
          }
        ]
      } as unknown as UIMessage,
      assistantTurn('a0'),
      ...thread(20, 1),
      userTurn('current', 0)
    ]

    const [placeholder] = placeholders(
      capHistoricalAttachments(messages, LIMIT)
    )

    expect(placeholder).toContain('&lt;script&gt;')
    expect(placeholder).not.toContain('<script>')
    expect(placeholder).not.toContain('\n')
    expect(placeholder).not.toContain('X-Amz-Signature')
    expect(placeholder).not.toContain('https://')
  })

  it('replays everything when the limit is disabled', () => {
    const messages = thread(70, 1).concat(userTurn('current', 0))

    expect(capHistoricalAttachments(messages, 0, 0)).toEqual(messages)
  })

  it('counts attachments across turns, not per message', () => {
    // 7 turns x 3 files = 21 in history -> one block of 10 is droppable.
    const capped = capHistoricalAttachments(
      thread(7, 3).concat(userTurn('current', 0)),
      LIMIT
    )

    expect(placeholders(capped)).toHaveLength(LIMIT)
    expect(filenamesReaching(capped)).toHaveLength(11)
  })

  it('bounds heavy attachments below the count limit by weight blocks', () => {
    const messages = pdfThread(4).concat(userTurn('current', 0))
    const capped = capHistoricalAttachments(messages, LIMIT, 20_000)

    expect(filenamesReaching(capped)).toEqual(['u2.pdf', 'u3.pdf'])
    expect(placeholders(capped)).toHaveLength(2)
  })

  it('keeps the weighted replay prefix stable between block crossings', () => {
    const atFour = capHistoricalAttachments(
      pdfThread(4, 1_000_000).concat(userTurn('current', 0)),
      0,
      20_000
    )
    const atFive = capHistoricalAttachments(
      pdfThread(5, 1_000_000).concat(userTurn('current', 0)),
      0,
      20_000
    )

    const replayedPrefixLength = atFour.length - 1
    expect(atFive.slice(0, replayedPrefixLength)).toEqual(
      atFour.slice(0, replayedPrefixLength)
    )
    expect(placeholders(atFour)).toHaveLength(2)
    expect(placeholders(atFive)).toHaveLength(2)
  })

  it('still applies the weight bound when the count cap is disabled', () => {
    const capped = capHistoricalAttachments(
      pdfThread(4).concat(userTurn('current', 0)),
      0,
      20_000
    )

    expect(filenamesReaching(capped)).toEqual(['u2.pdf', 'u3.pdf'])
  })

  it('keeps a historical attachment when one file exceeds the budget', () => {
    const messages = pdfThread(1, 1_000_000).concat(userTurn('current', 0))

    expect(filenamesReaching(capHistoricalAttachments(messages, 0, 1))).toEqual(
      ['u0.pdf']
    )
  })

  it('leaves a thread within the weight budget untouched', () => {
    const messages = pdfThread(5, 100_000).concat(userTurn('current', 0))

    expect(capHistoricalAttachments(messages, LIMIT, 200_000)).toBe(messages)
  })

  it('bounds multiple large PDFs with the default weight budget', () => {
    const messages = pdfThread(4, 10_000_000).concat(userTurn('current', 0))
    const capped = capHistoricalAttachments(messages, LIMIT, 200_000)

    expect(filenamesReaching(capped)).toEqual(['u2.pdf', 'u3.pdf'])
    expect(placeholders(capped)).toHaveLength(2)
  })

  it('never applies the weight bound to the newest user message', () => {
    const messages = thread(1, 0).concat(userTurn('current', 0))
    messages.at(-1)?.parts.unshift({
      type: 'file',
      mediaType: 'application/pdf',
      filename: 'current.pdf',
      url: 'https://example.com/current.pdf',
      size: 5_000_000
    } as never)

    expect(capHistoricalAttachments(messages, LIMIT, 1).at(-1)).toEqual(
      messages.at(-1)
    )
  })

  it('disables the weight bound with an explicit zero', () => {
    const messages = thread(25, 1).concat(userTurn('current', 0))

    expect(capHistoricalAttachments(messages, 100, 0)).toBe(messages)
  })
})

describe('parseReplayLimit', () => {
  it('falls back to the default for anything unusable', () => {
    // An empty string is the one that matters: templated environments define
    // variables as '' all the time, and Number('') is 0, which would look like
    // a deliberate "replay everything".
    for (const raw of [undefined, '', '   ', 'ten', '-1', 'NaN', 'Infinity']) {
      expect(parseReplayLimit(raw)).toBe(10)
    }
  })

  it('disables the cap only on an explicit zero', () => {
    expect(parseReplayLimit('0')).toBe(0)
    expect(parseReplayLimit(' 0 ')).toBe(0)
  })

  it('keeps at least one attachment for any positive value', () => {
    expect(parseReplayLimit('0.5')).toBe(1)
    expect(parseReplayLimit('4')).toBe(4)
    expect(parseReplayLimit('12.9')).toBe(12)
  })
})

describe('parseAttachmentTokenBudget', () => {
  it('falls back to the default for unusable values', () => {
    for (const raw of [undefined, '', '   ', 'many', '-1', 'NaN', 'Infinity']) {
      expect(parseAttachmentTokenBudget(raw)).toBe(200_000)
    }
  })

  it('disables the budget only on an explicit zero', () => {
    expect(parseAttachmentTokenBudget('0')).toBe(0)
    expect(parseAttachmentTokenBudget(' 0 ')).toBe(0)
  })

  it('keeps at least one token for positive values', () => {
    expect(parseAttachmentTokenBudget('0.5')).toBe(1)
    expect(parseAttachmentTokenBudget('1200.9')).toBe(1200)
  })
})
