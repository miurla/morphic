import { researcher } from '@/lib/agents/researcher'
import { openai } from '@ai-sdk/openai'
import {
  appendClientMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  UIMessageStreamWriter
} from 'ai'
import { saveChatMessage, saveSingleMessage } from '../actions/chat-db'
import { generateChatTitle } from '../agents/title-generator'
import { getChat, getChatMessages } from '../db/chat'
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
          const title = await generateChatTitle({
            userMessageContent: getTextFromParts(message.parts),
            model: openai('gpt-4o-mini')
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
          messages: convertToModelMessages(messages),
          model: modelId,
          searchMode
        })

        const result = streamText({
          ...researcherConfig
        })

        writer.merge(result.toUIMessageStream())

        const responseMessages = (await result.response).messages
        console.log('responseMessages', responseMessages)

        // Save the assistant message to the database using server action
        // if (assistantMessage) {
        //   await saveSingleMessage({
        //     id: assistantId,
        //     chatId,
        //     role: assistantMessage.role,
        //     parts: assistantMessage.parts
        //   })
        // }
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
