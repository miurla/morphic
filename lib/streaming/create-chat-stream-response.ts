import { researcher } from '@/lib/agents/researcher'
import {
  appendClientMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessageStreamWriter
} from 'ai'
import { saveChatMessage, saveSingleMessage } from '../actions/chat-db'
import { generateChatTitle } from '../agents/title-generator'
import { getChat, getChatMessages } from '../db/chat'
import { generateUUID } from '../utils'
import { getTextFromParts } from '../utils/message-utils'
import { BaseStreamConfig } from './types'

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const { message, model, chatId, searchMode, userId } = config
  const modelId = `${model.providerId}:${model.id}`

  // Fetch chat data for authorization check before stream creation
  const chatForAuth = await getChat(chatId, userId)

  // Authorization check: if chat exists and does not belong to the user
  if (chatForAuth && chatForAuth.userId !== userId) {
    return new Response('You are not allowed to access this chat', {
      status: 403,
      statusText: 'Forbidden'
    })
  }

  // If authorized or it's a new chat, proceed to create the stream
  const stream = createUIMessageStream({
    execute: async (writer: UIMessageStreamWriter) => {
      try {
        // Use chatForAuth (from outer scope) to decide new/existing path
        if (!chatForAuth) {
          // New chat
          const userContent = getTextFromParts(message.parts)
          const title = await generateChatTitle({
            userMessageContent: userContent,
            modelId
          })
          await saveChatMessage(chatId, message, userId, title)
        } else {
          // Existing chat, and user is authorized (auth check done outside)
          await saveSingleMessage(chatId, message)
        }

        const previousMessages = await getChatMessages(chatId)
        const messagesToModel = appendClientMessage({
          // @ts-ignore
          messages: previousMessages,
          message
        })

        const result = await researcher({
          messages: convertToModelMessages(messagesToModel),
          model: modelId,
          searchMode
        })

        writer.merge(
          result.toUIMessageStream({
            newMessageId: generateUUID(),
            onFinish({ messages: resultingMessages }) {
              const assistantMessage = resultingMessages.find(
                m => m.role === 'assistant'
              )
              if (assistantMessage) {
                saveSingleMessage(chatId, assistantMessage)
              }
            }
          })
        )
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error // This error will be handled by the onError callback
      }
    },
    onError: (error: any) => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })

  return createUIMessageStreamResponse({ stream })
}
