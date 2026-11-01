import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { SOURCE_CONTEXT_MESSAGE_SUFFIX } from '../compact-historical-messages'
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

  it('appends the draft to the user message after its source only', () => {
    const first = message('user', 'one', 'u1')
    const result = attachCurrentDraft(
      [first, message('assistant', 'reply', 'a'), message('user', 'two', 'u2')],
      draft
    )

    expect(result[0]).toBe(first)
    expect(result[2].parts).toHaveLength(2)
    expect(textOf(result[2], 1)).toContain('<current_draft title="T"')
    expect(textOf(result[2], 1)).toMatch(
      /^The chat draft below is attached by the app/
    )
  })

  it('keeps the draft in place as the thread grows', () => {
    const thread = [
      message('user', 'one', 'u1'),
      message('assistant', 'reply', 'a'),
      message('user', 'two', 'u2'),
      message('assistant', 'reply', 'a2')
    ]
    const before = attachCurrentDraft(thread, draft)
    const after = attachCurrentDraft(
      [...thread, message('user', 'three', 'u3')],
      draft
    )

    expect(after.slice(0, before.length)).toEqual(before)
    expect(after[4].parts).toHaveLength(1)
  })

  it('anchors after the opening turn when the source was trimmed', () => {
    const result = attachCurrentDraft(
      [
        message('user', 'one', 'u1'),
        message('assistant', 'reply', 'a1'),
        message('user', 'two', 'u2'),
        message('assistant', 'reply', 'a2'),
        message('user', 'three', 'u3')
      ],
      draft
    )

    expect(result[2].parts).toHaveLength(2)
    expect(result[4].parts).toHaveLength(1)
  })

  it('skips source context messages when anchoring', () => {
    const result = attachCurrentDraft(
      [
        message('assistant', 'reply', 'a'),
        message('user', 'sources', `u1${SOURCE_CONTEXT_MESSAGE_SUFFIX}`),
        message('user', 'two', 'u2')
      ],
      draft
    )

    expect(result[1].parts).toHaveLength(1)
    expect(result[2].parts).toHaveLength(2)
  })

  it('moves to the latest user message when asked to', () => {
    const result = attachCurrentDraft(
      [
        message('assistant', 'reply', 'a'),
        message('user', 'one', 'u1'),
        message('assistant', 'reply', 'a2'),
        message('user', 'two', 'u2')
      ],
      draft,
      { atLatest: true }
    )

    expect(result[1].parts).toHaveLength(1)
    expect(result[3].parts).toHaveLength(2)
  })

  it('leaves messages alone without a draft', () => {
    const messages = [message('user', 'one')]
    expect(attachCurrentDraft(messages, null)).toBe(messages)
  })
})
