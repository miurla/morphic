'use server'

import { eq } from 'drizzle-orm'
import { Langfuse } from 'langfuse'

import { chatCache } from '@/lib/cache/memory-cache'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { isTracingEnabled } from '@/lib/utils/telemetry'

export async function updateMessageFeedback(
  messageId: string,
  score: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the current message to preserve existing metadata and get chatId
    const [currentMessage] = await db
      .select({
        metadata: messages.metadata,
        chatId: messages.chatId
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!currentMessage) {
      return { success: false, error: 'Message not found' }
    }

    // Merge the feedback score with existing metadata
    const updatedMetadata = {
      ...(currentMessage.metadata || {}),
      feedbackScore: score
    }

    // Update the message with the new feedback score
    await db
      .update(messages)
      .set({ metadata: updatedMetadata })
      .where(eq(messages.id, messageId))

    // Send feedback to Langfuse if trace ID exists and tracing is enabled
    const traceId = (currentMessage.metadata as any)?.traceId
    if (traceId && isTracingEnabled()) {
      const langfuse = new Langfuse()
      langfuse.score({
        traceId,
        name: 'user-feedback',
        value: score,
        comment: score === 1 ? 'Thumbs up' : 'Thumbs down'
      })
      await langfuse.flushAsync()
    }

    // Invalidate cache for this chat to ensure fresh data is loaded
    if (currentMessage.chatId) {
      chatCache.deletePattern(`${currentMessage.chatId}-`)
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update feedback' 
    }
  }
}

export async function getMessageFeedback(messageId: string): Promise<number | null> {
  try {
    const [message] = await db
      .select({ metadata: messages.metadata })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!message) {
      return null
    }

    return (message.metadata as any)?.feedbackScore || null
  } catch (error) {
    console.error('Error getting message feedback:', error)
    return null
  }
}