'use server'

import { eq } from 'drizzle-orm'
import { Langfuse } from 'langfuse'

import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'
import type { UIMessageMetadata } from '@/lib/types/ai'
import { isTracingEnabled } from '@/lib/utils/telemetry'

export async function updateMessageFeedback(
  messageId: string,
  score: number,
  userId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use RLS context for all database operations
    const result = await withOptionalRLS(userId, async tx => {
      // Get the current message to preserve existing metadata and get chatId
      const [currentMessage] = await tx
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
      await tx
        .update(messages)
        .set({ metadata: updatedMetadata })
        .where(eq(messages.id, messageId))

      return { success: true, metadata: currentMessage.metadata }
    })

    if (!result.success) {
      return result
    }

    // Send feedback to Langfuse if trace ID exists and tracing is enabled
    const traceId = (result.metadata as UIMessageMetadata)?.traceId
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

    return { success: true }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update feedback'
    }
  }
}

export async function getMessageFeedback(
  messageId: string,
  userId: string | null = null
): Promise<number | null> {
  try {
    const result = await withOptionalRLS(userId, async tx => {
      const [message] = await tx
        .select({ metadata: messages.metadata })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1)

      if (!message) {
        return null
      }

      return (message.metadata as UIMessageMetadata)?.feedbackScore || null
    })

    return result
  } catch (error) {
    console.error('Error getting message feedback:', error)
    return null
  }
}
