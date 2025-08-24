import { UIMessage, UIMessageStreamWriter } from 'ai'

import { upsertMessage } from '@/lib/actions/chat'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { updateChatTitle } from '@/lib/db/actions'
import { generateId } from '@/lib/db/schema'
import { hasToolCalls } from '@/lib/utils/message-utils'
import { perfTime } from '@/lib/utils/perf-logging'
import { retryDatabaseOperation } from '@/lib/utils/retry'

import type { StreamContext } from './types'

const DEFAULT_CHAT_TITLE = 'Untitled'

export async function handleStreamFinish(
  writer: UIMessageStreamWriter,
  responseMessage: UIMessage,
  messagesToModel: UIMessage[],
  context: StreamContext,
  titlePromise?: Promise<string>
) {
  const { chatId, userId, modelId, abortSignal, parentTraceId } = context

  // Attach metadata to the response message if we have a traceId
  if (parentTraceId) {
    responseMessage.metadata = {
      ...(responseMessage.metadata || {}),
      traceId: parentTraceId
    }
  }

  // Generate related questions if there are tool calls
  if (hasToolCalls(responseMessage as UIMessage | null)) {
    const questionPartId = generateId()

    try {
      writer.write({
        type: 'data-relatedQuestions',
        id: questionPartId,
        data: { status: 'loading' }
      })

      // Use RELATED_QUESTION_MODEL env var if set, otherwise use the main model
      const questionModel = process.env.RELATED_QUESTION_MODEL || modelId

      const relatedQuestions = await generateRelatedQuestions(
        questionModel,
        [...messagesToModel, responseMessage],
        abortSignal,
        parentTraceId
      )

      responseMessage.parts.push({
        type: 'data-relatedQuestions',
        id: questionPartId,
        data: {
          status: 'success',
          questions: relatedQuestions.questions
        }
      })

      writer.write({
        type: 'data-relatedQuestions',
        id: questionPartId,
        data: {
          status: 'success',
          questions: relatedQuestions.questions
        }
      })
    } catch (error) {
      console.error('Error generating related questions:', error)
      writer.write({
        type: 'data-relatedQuestions',
        id: questionPartId,
        data: { status: 'error' }
      })
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
