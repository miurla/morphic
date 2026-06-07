import { capture } from './dispatch'
import type { ChatEventData } from './types'

/**
 * Track a chat event.
 *
 * Sent only when MORPHIC_CLOUD_DEPLOYMENT=true. The raw query is never sent;
 * only the derived query shape is included.
 */
export async function trackChatEvent(data: ChatEventData): Promise<void> {
  const { userId, queryShape, ...rest } = data

  await capture({
    event: 'chat_message_sent',
    distinctId: userId,
    properties: {
      ...rest,
      userId,
      ...queryShape
    }
  })
}
