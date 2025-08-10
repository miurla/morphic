import { eq } from 'drizzle-orm'
import { Langfuse } from 'langfuse'

import { chatCache } from '@/lib/cache/memory-cache'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { isTracingEnabled } from '@/lib/utils/telemetry'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { traceId, score, comment, messageId } = body

    if (!traceId) {
      return new Response('traceId is required', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    if (score === undefined || (score !== 1 && score !== -1)) {
      return new Response('score must be 1 (good) or -1 (bad)', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    // Check if tracing is enabled
    if (!isTracingEnabled()) {
      return new Response('Feedback tracking is not enabled', {
        status: 200
      })
    }

    // Initialize Langfuse client
    const langfuse = new Langfuse()

    // Send score to Langfuse
    langfuse.score({
      traceId,
      name: 'user_feedback',
      value: score,
      comment
    })

    // Flush to ensure the score is sent
    await langfuse.flushAsync()

    // Update the message metadata with the feedback score
    if (messageId) {
      try {
        // First get the current message to preserve existing metadata and get chatId
        const [currentMessage] = await db
          .select({
            metadata: messages.metadata,
            chatId: messages.chatId
          })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1)

        // Merge the feedback score with existing metadata
        const updatedMetadata = {
          ...(currentMessage?.metadata || {}),
          feedbackScore: score
        }

        // Update the message with the new metadata
        await db
          .update(messages)
          .set({ metadata: updatedMetadata })
          .where(eq(messages.id, messageId))

        // Invalidate cache for this chat to ensure fresh data is loaded
        if (currentMessage?.chatId) {
          chatCache.deletePattern(`${currentMessage.chatId}-`)
        }
      } catch (dbError) {
        console.error('Error updating message metadata:', dbError)
        // Continue even if database update fails
      }
    }

    return new Response('Feedback recorded successfully', {
      status: 200
    })
  } catch (error) {
    console.error('Error recording feedback:', error)
    return new Response('Error recording feedback', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
