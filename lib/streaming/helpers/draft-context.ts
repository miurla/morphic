import { UIMessage } from 'ai'

import {
  compactDraftBlocks,
  type DraftVersion,
  formatCurrentDraft
} from '@/lib/draft/draft'

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
 * Attaches the current draft to the latest user message, the tail of the
 * prompt, so it never sits inside the cached prefix. The model needs the exact
 * text to write editDraft find strings.
 */
export function attachCurrentDraft(
  messages: UIMessage[],
  currentDraft: DraftVersion | null
): UIMessage[] {
  if (!currentDraft) return messages

  const index = messages.findLastIndex(msg => msg.role === 'user')
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
