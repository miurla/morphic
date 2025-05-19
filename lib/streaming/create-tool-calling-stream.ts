import { researcher } from '@/lib/agents/researcher'
import { openai } from '@ai-sdk/openai'
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

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  const stream = createUIMessageStream({
    execute: async (writer: UIMessageStreamWriter) => {
      const { message, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const chat = await getChat(chatId, userId)
        if (!chat) {
          const userContent = getTextFromParts(message.parts)
          const title = await generateChatTitle({
            userMessageContent: userContent,
            model: openai('gpt-4o-mini')
          })

          await saveChatMessage(chatId, message, userId, title)
        } else {
          if (chat.userId !== userId) {
            // TODO: Handle this
            // return new Response('You are not allowed to access this chat', {
            //   status: 403,
            //   statusText: 'Forbidden'
            // })
          }

          // Save just the user message to an existing chat
          await saveSingleMessage(chatId, message)
        }

        const previousMessages = await getChatMessages(chatId)
        const messages = appendClientMessage({
          // @ts-ignore
          messages: previousMessages,
          message
        })

        const result = await researcher({
          messages: convertToModelMessages(messages),
          model: modelId,
          searchMode
        })

        writer.merge(
          result.toUIMessageStream({
            newMessageId: generateUUID(),
            onFinish({ messages }) {
              const assistantMessage = messages.find(
                message => message.role === 'assistant'
              )
              if (assistantMessage) {
                saveSingleMessage(chatId, assistantMessage)
              }
            }
          })
        )
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error
      }
    },
    onError: (error: any) => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })

  return createUIMessageStreamResponse({ stream })
}
