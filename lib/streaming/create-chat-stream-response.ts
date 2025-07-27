import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
  UIMessageStreamWriter
} from 'ai'

import { researcher } from '@/lib/agents/researcher'

import {
  createChat,
  deleteMessagesFromIndex,
  getChat as getChatAction,
  saveMessage
} from '../actions/chat'
import { generateRelatedQuestions } from '../agents/generate-related-questions'
import { generateChatTitle } from '../agents/title-generator'
import { generateId } from '../db/schema'
import { getTextFromParts, mergeUIMessages } from '../utils/message-utils'

import { BaseStreamConfig } from './types'

// Constants
const DEFAULT_CHAT_TITLE = 'New Chat'

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const { message, model, chatId, searchMode, userId, trigger, messageId } =
    config
  const modelId = `${model.providerId}:${model.id}`

  // Verify that chatId is provided
  if (!chatId) {
    return new Response('Chat ID is required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  // Fetch chat data for authorization check
  const chat = await getChatAction(chatId, userId)

  // Authorization check: if chat exists, it must belong to the user
  if (chat && chat.userId !== userId) {
    return new Response('You are not allowed to access this chat', {
      status: 403,
      statusText: 'Forbidden'
    })
  }

  // Create the stream
  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      try {
        let messagesToModel: UIMessage[]

        if (trigger === 'regenerate-assistant-message' && messageId) {
          // Handle regeneration
          // Find the message to regenerate from
          const currentChat = await getChatAction(chatId, userId)
          if (!currentChat || !currentChat.messages.length) {
            throw new Error('No messages found')
          }

          const messageIndex = currentChat.messages.findIndex(
            m => m.id === messageId
          )
          if (messageIndex === -1) {
            throw new Error(`Message ${messageId} not found`)
          }

          // Check if it's an assistant message that needs regeneration
          const targetMessage = currentChat.messages[messageIndex]
          if (targetMessage.role === 'assistant') {
            // Delete from this assistant message onwards
            await deleteMessagesFromIndex(chatId, messageId)
            // Use messages up to (but not including) this assistant message
            messagesToModel = currentChat.messages.slice(0, messageIndex)
          } else {
            // If it's a user message that was edited, save the updated message first
            if (message && message.id === messageId) {
              await saveMessage(chatId, message)
            }
            // Delete everything after this user message
            const messagesToDelete = currentChat.messages.slice(
              messageIndex + 1
            )
            if (messagesToDelete.length > 0) {
              await deleteMessagesFromIndex(chatId, messagesToDelete[0].id)
            }
            // Get updated messages including the edited one
            const updatedChat = await getChatAction(chatId, userId)
            if (updatedChat?.messages) {
              messagesToModel = updatedChat.messages
            } else {
              // Fallback: use current messages up to and including the edited message
              messagesToModel = currentChat.messages.slice(0, messageIndex + 1)
            }
          }
        } else {
          // Handle normal message submission
          if (!message) {
            throw new Error('No message provided')
          }

          // Save the message
          const messageWithId = {
            ...message,
            id: message.id || generateId()
          }

          // If chat doesn't exist, create it with a temporary title
          if (!chat) {
            await createChat(chatId, DEFAULT_CHAT_TITLE)
          }

          await saveMessage(chatId, messageWithId)

          // Get all messages including the one just saved
          const updatedChat = await getChatAction(chatId, userId)
          messagesToModel = updatedChat?.messages || [messageWithId]
        }

        // Get the researcher agent
        const researchAgent = researcher({
          model: modelId,
          searchMode
        })

        // Stream with the research agent
        const researchResult = researchAgent.stream({
          messages: convertToModelMessages(messagesToModel)
        })

        // Store messages for merging
        let researchMessage: UIMessage | null = null
        let relatedQuestionsMessage: UIMessage | null = null

        // Merge research stream without finishing and capture the message
        writer.merge(
          researchResult.toUIMessageStream({
            sendFinish: false,
            onFinish: ({ responseMessage }) => {
              researchMessage = responseMessage
            }
          })
        )

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

              // Merge related questions stream
              writer.merge(
                relatedQuestionsResult.toUIMessageStream({
                  sendStart: false,
                  onFinish: async ({ responseMessage }) => {
                    relatedQuestionsMessage = responseMessage

                    // Save the complete message after both agents finish
                    // Merge and save both messages
                    if (researchMessage && relatedQuestionsMessage) {
                      const mergedMessage = mergeUIMessages(
                        researchMessage,
                        relatedQuestionsMessage
                      )
                      await saveMessage(chatId, mergedMessage)
                    } else if (researchMessage) {
                      // Save research message only if related questions failed
                      await saveMessage(chatId, researchMessage)
                    }

                    // Generate proper title after conversation starts
                    if (!chat && message) {
                      const userContent = getTextFromParts(message.parts)
                      const title = await generateChatTitle({
                        userMessageContent: userContent,
                        modelId
                      })
                      // Update chat title
                      const { updateChatTitle } = await import('../db/actions')
                      await updateChatTitle(chatId, title)
                    }
                  }
                })
              )
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
