import { UIMessage } from 'ai'

import {
  compactDraftBlocks,
  type DraftVersion,
  formatCurrentDraft
} from '@/lib/draft/draft'

import { isSourceContextMessage } from './compact-historical-messages'

/**
 * Replaces draft blocks in assistant text with a one-line stub. Every version
 * would otherwise replay in full on each later turn. The stub depends only on
 * the message, so the prompt-cache prefix stays stable.
 */
export function compactDraftsInMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant' || !msg.parts) return msg

    let changed = false
    const parts = msg.parts.map(part => {
      if (part.type !== 'text' || typeof part.text !== 'string') return part
      const text = compactDraftBlocks(part.text)
      if (text === part.text) return part
      changed = true
      return { ...part, text }
    })

    return changed ? { ...msg, parts } : msg
  })
}

/**
 * The first user message after the one that produced the draft. It stays put
 * until the draft changes, so later turns only append to the prompt. Without
 * the source message it was trimmed from the middle of the thread, which leaves
 * only the opening turn before it.
 */
function findDraftAnchor(messages: UIMessage[], sourceId: string): number {
  const isUser = (message: UIMessage) =>
    message.role === 'user' && !isSourceContextMessage(message)

  const source = messages.findIndex(msg => msg.id === sourceId)
  const after = source >= 0 ? source : messages.findIndex(isUser)
  const next = messages.findIndex((msg, i) => i > after && isUser(msg))

  return next >= 0 ? next : messages.findLastIndex(isUser)
}

/**
 * Attaches the current draft to a user message. The model needs the exact text
 * to write editDraft find strings. The prompt cache only extends a previous
 * request, so a draft at the moving tail would rewrite the whole thread each
 * turn. Pass atLatest when older messages are about to be dropped.
 */
export function attachCurrentDraft(
  messages: UIMessage[],
  currentDraft: DraftVersion | null,
  { atLatest = false }: { atLatest?: boolean } = {}
): UIMessage[] {
  if (!currentDraft) return messages

  const index = atLatest
    ? messages.findLastIndex(msg => msg.role === 'user')
    : findDraftAnchor(messages, currentDraft.messageId)
  if (index < 0) return messages

  const target = messages[index]
  const withDraft = {
    ...target,
    parts: [
      ...(target.parts ?? []),
      { type: 'text' as const, text: formatCurrentDraft(currentDraft) }
    ]
  }

  return [...messages.slice(0, index), withDraft, ...messages.slice(index + 1)]
}
