import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { attachCurrentDraft, compactDraftsInMessages } from '../draft-context'

const DRAFT = ['Done.', '', '````draft', 'title: T', '', 'Body', '````'].join(
  '\n'
)

function message(role: 'user' | 'assistant', text: string, id: string = role) {
  return { id, role, parts: [{ type: 'text', text }] } as unknown as UIMessage
}

function textOf(msg: UIMessage, i = 0): string {
  const part = msg.parts[i]
  return part.type === 'text' ? part.text : ''
}

describe('compactDraftsInMessages', () => {
  it('stubs draft blocks in assistant messages only', () => {
    const user = message('user', DRAFT)
    const [u, a] = compactDraftsInMessages([user, message('assistant', DRAFT)])

    expect(u).toBe(user)
    expect(textOf(a)).not.toContain('````draft')
    expect(textOf(a)).toContain('[Draft "T" written here (4 characters)')
  })

  it('returns the same message object when nothing changes', () => {
    const plain = message('assistant', 'No draft')
    expect(compactDraftsInMessages([plain])[0]).toBe(plain)
  })
})

describe('attachCurrentDraft', () => {
  const draft = {
    version: 1,
    title: 'T',
    content: 'Body',
    kind: 'write' as const,
    messageId: 'a'
  }

  it('appends the draft to the latest user message only', () => {
    const first = message('user', 'one', 'u1')
    const result = attachCurrentDraft(
      [first, message('assistant', 'reply'), message('user', 'two', 'u2')],
      draft
    )

    expect(result[0]).toBe(first)
    expect(result[2].parts).toHaveLength(2)
    expect(textOf(result[2], 1)).toContain('<current_draft title="T"')
  })

  it('leaves messages alone without a draft', () => {
    const messages = [message('user', 'one')]
    expect(attachCurrentDraft(messages, null)).toBe(messages)
  })
})
