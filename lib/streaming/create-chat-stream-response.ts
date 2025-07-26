import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
  UIMessageStreamWriter
} from 'ai'

import { researcher } from '@/lib/agents/researcher'

import { saveChatMessage, saveSingleMessage } from '../actions/chat-db'
import { generateRelatedQuestions } from '../agents/generate-related-questions'
import { generateChatTitle } from '../agents/title-generator'
import { getChat, getChatMessages } from '../db/chat'
import { getTextFromParts, mergeUIMessages } from '../utils/message-utils'

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
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
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

        // Convert database messages to UIMessage format
        const previousUIMessages: UIMessage[] = previousMessages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          parts: msg.parts as UIMessage['parts']
        }))

        const messagesToModel = [...previousUIMessages, message]

        // Get the researcher agent
        const researchAgent = researcher({
          model: modelId,
          searchMode
        })

        // Stream with the research agent
        const researchResult = researchAgent.stream({
          messages: convertToModelMessages(messagesToModel)
        })

        // Merge research stream without finishing
        writer.merge(
          researchResult.toUIMessageStream({
            sendFinish: false
          })
        )

        // Store messages for merging
        let researchMessage: UIMessage | null = null
        let relatedQuestionsMessage: UIMessage | null = null

        // After research completes, generate related questions
        researchResult.response
          .then(async researchData => {
            // Check if request was aborted
            if (researchData.messages.length === 0) {
              return
            }

            try {
              // Prepare messages for related questions agent
              const allMessages = [
                ...convertToModelMessages(messagesToModel),
                ...researchData.messages
              ]

              // Get related questions agent
              const relatedQuestionsAgent = generateRelatedQuestions(modelId)
              const relatedQuestionsResult = relatedQuestionsAgent.stream({
                messages: allMessages
              })

              // Capture research message from the stream
              researchResult.toUIMessageStream({
                onFinish: ({ responseMessage }) => {
                  researchMessage = responseMessage
                }
              })

              // Merge related questions stream
              writer.merge(
                relatedQuestionsResult.toUIMessageStream({
                  sendStart: false,
                  onFinish: ({ responseMessage }) => {
                    relatedQuestionsMessage = responseMessage
                  }
                })
              )

              // Save the complete message after both agents finish
              relatedQuestionsResult.response
                .then(async () => {
                  // Merge and save both messages
                  if (researchMessage && relatedQuestionsMessage) {
                    const mergedMessage = mergeUIMessages(
                      researchMessage,
                      relatedQuestionsMessage
                    )
                    await saveSingleMessage(chatId, mergedMessage)
                  } else if (researchMessage) {
                    // Save research message only if related questions failed
                    await saveSingleMessage(chatId, researchMessage)
                  }
                })
                .catch(error => {
                  console.error('Related questions error:', error)
                  // Save research message even if related questions fail
                  if (researchMessage) {
                    saveSingleMessage(chatId, researchMessage)
                  }
                })
            } catch (error) {
              console.error('Error generating related questions:', error)
            }
          })
          .catch(error => {
            // Handle abort errors gracefully
            if (error.name === 'AbortError') {
              console.log('Stream aborted by client')
              return
            }
            console.error('Research agent error:', error)
          })
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
