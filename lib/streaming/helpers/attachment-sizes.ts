import type { UIMessage } from 'ai'

import { getAttachmentSizesByObjectKey } from '@/lib/db/actions'

import { isFilePart } from './attachment-parts'

export async function resolveAttachmentSizes(
  messages: UIMessage[],
  userId: string
): Promise<UIMessage[]> {
  const objectKeys = [
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
