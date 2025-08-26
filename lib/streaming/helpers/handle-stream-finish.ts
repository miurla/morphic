import { UIMessage } from 'ai'

import { upsertMessage } from '@/lib/actions/chat'
import { updateChatTitle } from '@/lib/db/actions'
import { perfTime } from '@/lib/utils/perf-logging'
import { retryDatabaseOperation } from '@/lib/utils/retry'

const DEFAULT_CHAT_TITLE = 'Untitled'

export async function handleStreamFinish(
  responseMessage: UIMessage,
  chatId: string,
  userId: string,
  titlePromise?: Promise<string>,
  parentTraceId?: string
) {
  // Attach metadata to the response message if we have a traceId
  if (parentTraceId) {
    responseMessage.metadata = {
      ...(responseMessage.metadata || {}),
      traceId: parentTraceId
    }
  }

  // Wait for title generation if it was started
  const chatTitle = titlePromise ? await titlePromise : undefined

  // Save message with retry logic
  const saveStart = performance.now()
  try {
    await upsertMessage(chatId, responseMessage, userId)
    perfTime('upsertMessage (AI response) completed', saveStart)
  } catch (error) {
    console.error('Error saving message:', error)
    try {
      await retryDatabaseOperation(
        () => upsertMessage(chatId, responseMessage, userId),
        'save message'
      )
      perfTime('upsertMessage (AI response) completed after retry', saveStart)
    } catch (retryError) {
      console.error('Failed to save after retries:', retryError)
      // Don't throw here to avoid breaking the stream
    }
  }

  // Update title after message is saved
  if (chatTitle && chatTitle !== DEFAULT_CHAT_TITLE) {
    try {
      await updateChatTitle(chatId, chatTitle, userId)
    } catch (error) {
      console.error('Error updating title:', error)
      // Don't throw here as title update is not critical
    }
  }
}
