import { UIMessage, UIMessageStreamWriter } from 'ai'

import { saveMessage } from '@/lib/actions/chat'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { updateChatTitle } from '@/lib/db/actions'
import { generateId } from '@/lib/db/schema'
import { hasToolCalls } from '@/lib/utils/message-utils'
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
  const { chatId, modelId, abortSignal } = context

  // Generate related questions if there are tool calls
  if (hasToolCalls(responseMessage as UIMessage | null)) {
    const questionPartId = generateId()

    try {
      writer.write({
        type: 'data-relatedQuestions',
        id: questionPartId,
        data: { status: 'loading' }
      })

      const relatedQuestions = await generateRelatedQuestions(
        modelId,
        [...messagesToModel, responseMessage],
        abortSignal
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
  saveMessage(chatId, responseMessage).catch(async error => {
    console.error('Error saving message:', error)
    try {
      await retryDatabaseOperation(
        () => saveMessage(chatId, responseMessage),
        'save message'
      )
    } catch (retryError) {
      console.error('Failed to save after retries:', retryError)
    }
  })

  // Update title after message is saved
  if (chatTitle && chatTitle !== DEFAULT_CHAT_TITLE) {
    updateChatTitle(chatId, chatTitle).catch(error =>
      console.error('Error updating title:', error)
    )
  }
}
