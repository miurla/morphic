import { researcher } from '@/lib/agents/researcher'
import {
  convertMessagesForDB,
  extractTitleFromMessage
} from '@/lib/utils/message-utils'
import {
  convertToCoreMessages,
  CoreMessage,
  createDataStreamResponse,
  DataStreamWriter,
  streamText
} from 'ai'
import { saveChat } from '../actions/chat-db'
import { getCurrentUserId } from '../auth/get-current-user'
import { getChat } from '../db/chat'
import { getMaxAllowedTokens, truncateMessages } from '../utils/context-window'
import { BaseStreamConfig } from './types'

// Function to check if a message contains ask_question tool invocation
function containsAskQuestionTool(message: CoreMessage) {
  // For CoreMessage format, we check the content array
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return false
  }

  // Check if any content item is a tool-call with ask_question tool
  return message.content.some(
    item => item.type === 'tool-call' && item.toolName === 'ask_question'
  )
}

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const coreMessages = convertToCoreMessages(messages)
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(model)
        )

        let researcherConfig = await researcher({
          messages: truncatedMessages,
          model: modelId,
          searchMode
        })

        const result = streamText({
          ...researcherConfig
          // onFinish: async result => {
          //   // Check if the last message contains an ask_question tool invocation
          //   const shouldSkipRelatedQuestions =
          //     isReasoningModel(modelId) ||
          //     (result.response.messages.length > 0 &&
          //       containsAskQuestionTool(
          //         result.response.messages[
          //           result.response.messages.length - 1
          //         ] as CoreMessage
          //       ))

          //   await handleStreamFinish({
          //     responseMessages: result.response.messages,
          //     originalMessages: messages,
          //     model: modelId,
          //     chatId,
          //     dataStream,
          //     userId,
          //     skipRelatedQuestions: shouldSkipRelatedQuestions
          //   })
          // }
        })

        result.mergeIntoDataStream(dataStream)

        const userId = await getCurrentUserId()
        const responseMessages = (await result.response).messages

        // Convert messages to database format
        const saveMessages = convertMessagesForDB(responseMessages)

        // Check if chat exists to determine title and update strategy
        const existingChat = await getChat(chatId, userId)

        // Get appropriate title - use existing title if available, otherwise extract from message
        const title = existingChat
          ? existingChat.title
          : extractTitleFromMessage(coreMessages[0]) || 'New Chat'

        // Save the chat to the database
        // Only update metadata if this is a new chat (existingChat is null)
        await saveChat(
          {
            id: chatId,
            title
          },
          saveMessages,
          userId,
          !existingChat // Only update metadata for new chats
        )
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error
      }
    },
    onError: error => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}
