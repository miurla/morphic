import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { stripSpecFromMessages } from '../strip-spec-from-messages'

const RELATED_BLOCK = [
  '```spec',
  '{"op":"add","path":"/root","value":"main"}',
  '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","questions"]}}',
  '{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}',
  '{"op":"add","path":"/elements/questions","value":{"type":"Stack","props":{"direction":"vertical","gap":"xs"},"children":["q1","q2","q3"]}}',
  '{"op":"add","path":"/elements/q1","value":{"type":"Button","props":{"text":"A follow-up question","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"A follow-up question"}}},"children":[]}}',
  '```'
].join('\n')

const IMAGE_BLOCK = [
  '```spec',
  '{"op":"add","path":"/root","value":"gallery"}',
  '{"op":"add","path":"/elements/gallery","value":{"type":"ImageGrid","props":{"columns":3},"children":[]}}',
  '```'
].join('\n')

function assistant(text: string): UIMessage {
  return {
    id: 'a1',
    role: 'assistant',
    parts: [{ type: 'text', text }]
  } as unknown as UIMessage
}

function textOf(message: UIMessage): string {
  const part = message.parts[0]
  return part.type === 'text' ? part.text : ''
}

describe('stripSpecFromMessages', () => {
  it('keeps the related-questions block', () => {
    const input = `Here is the answer.\n\n${RELATED_BLOCK}`
    const [result] = stripSpecFromMessages([assistant(input)])

    expect(textOf(result)).toBe(input)
  })

  it('strips a spec block that is not the related-questions block', () => {
    const input = `Here is the answer.\n\n${IMAGE_BLOCK}`
    const [result] = stripSpecFromMessages([assistant(input)])

    expect(textOf(result)).toBe('Here is the answer.')
  })

  it('keeps only the related block when a message carries both', () => {
    const input = [
      'Intro paragraph.',
      '',
      IMAGE_BLOCK,
      '',
      'Closing paragraph.',
      '',
      RELATED_BLOCK
    ].join('\n')

    const [result] = stripSpecFromMessages([assistant(input)])

    expect(textOf(result)).toBe(
      ['Intro paragraph.', '', 'Closing paragraph.', '', RELATED_BLOCK].join(
        '\n'
      )
    )
  })

  it('passes text without a spec block through byte-identically', () => {
    const input = '# Title\n\n\nBody with trailing space \n\nand a tail.\n\n'
    const [result] = stripSpecFromMessages([assistant(input)])

    expect(textOf(result)).toBe(input)
  })

  it('leaves user and system messages untouched', () => {
    const user = {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: `Question\n\n${IMAGE_BLOCK}` }]
    } as unknown as UIMessage
    const system = {
      id: 's1',
      role: 'system',
      parts: [{ type: 'text', text: `Instructions\n\n${IMAGE_BLOCK}` }]
    } as unknown as UIMessage

    const result = stripSpecFromMessages([user, system])

    expect(result[0]).toBe(user)
    expect(result[1]).toBe(system)
  })
})
