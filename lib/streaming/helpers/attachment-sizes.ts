import type { UIMessage } from 'ai'

import { getAttachmentSizesByObjectKey } from '@/lib/db/actions'

import { isFilePart } from './attachment-parts'

/**
 * Keys are collected oldest first, but the cap drops the oldest attachments,
 * so a thread with more keys than one lookup can carry is bounded from the
 * newest end. Resolving the ones about to be dropped would leave every
 * surviving file on the unknown estimate.
 */
const MAX_RESOLVED_KEYS = 100

export async function resolveAttachmentSizes(
  messages: UIMessage[],
  userId: string
): Promise<UIMessage[]> {
  const allKeys = [
    ...new Set(
      messages.flatMap(message =>
        message.parts.flatMap(part => {
          if (!isFilePart(part)) return []
          const key = (part as { key?: string }).key
          return key ? [key] : []
        })
      )
    )
  ]
  const objectKeys = allKeys.slice(-MAX_RESOLVED_KEYS)

  if (objectKeys.length === 0) return messages

  try {
    const sizes = await getAttachmentSizesByObjectKey({ userId, objectKeys })
    if (sizes.size === 0) return messages

    let changed = false
    const resolved = messages.map(message => {
      let messageChanged = false
      const parts = message.parts.map(part => {
        if (!isFilePart(part)) return part

        const key = (part as { key?: string }).key
        const size = key ? sizes.get(key) : undefined
        if (size === undefined) return part

        changed = true
        messageChanged = true
        return { ...part, size }
      })

      return messageChanged ? { ...message, parts } : message
    })

    return changed ? resolved : messages
  } catch (error) {
    console.error('Attachment size lookup failed:', error)
    return messages
  }
}
