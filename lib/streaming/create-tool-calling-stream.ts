import { researcher } from '@/lib/agents/researcher'
import {
  appendClientMessage,
  appendResponseMessages,
  createDataStreamResponse,
  DataStreamWriter,
  streamText
} from 'ai'
import { saveChatMessage, saveSingleMessage } from '../actions/chat-db'
import { generateChatTitle } from '../agents/title-generator'
import { getChat, getChatMessages } from '../db/chat'
import { generateUUID } from '../utils'
import { getTextFromParts } from '../utils/message-utils'
import { getModel } from '../utils/registry'
import { BaseStreamConfig } from './types'

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { message, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const chat = await getChat(chatId, userId)
        if (!chat) {
          const title = await generateChatTitle({
            userMessageContent: getTextFromParts(message.parts),
            model: getModel(modelId)
          })

          // Save the chat and user message to the database using server action
          await saveChatMessage(
            chatId,
            message.id,
            message.parts,
            message.role,
            userId,
            title
          )
        } else {
          if (chat.userId !== userId) {
            // TODO: Handle this
            // return new Response('You are not allowed to access this chat', {
            //   status: 403,
            //   statusText: 'Forbidden'
            // })
          }

          // Save just the user message to an existing chat
          await saveSingleMessage({
            id: message.id,
            chatId,
            role: message.role,
            parts: message.parts
          })
        }

        const previousMessages = await getChatMessages(chatId)
        const messages = appendClientMessage({
          // @ts-ignore
          messages: previousMessages,
          message
        })

        let researcherConfig = await researcher({
          messages,
          model: modelId,
          searchMode
        })

        const result = streamText({
          ...researcherConfig,
          experimental_generateMessageId: generateUUID
        })

        result.mergeIntoDataStream(dataStream)

        const responseMessages = (await result.response).messages
        const assistantId = responseMessages
          .filter(message => message.role === 'assistant')
          .at(-1)?.id
        if (!assistantId) {
          throw new Error('No assistant id found')
        }

        const [, assistantMessage] = appendResponseMessages({
          messages: [message],
          responseMessages: responseMessages
        })

        // Save the assistant message to the database using server action
        if (assistantMessage) {
          await saveSingleMessage({
            id: assistantId,
            chatId,
            role: assistantMessage.role,
            parts: assistantMessage.parts
          })
        }
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
