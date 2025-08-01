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
import {
  getTextFromParts,
  hasToolCalls,
  mergeUIMessages
} from '../utils/message-utils'

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

          let messageIndex = currentChat.messages.findIndex(
            m => m.id === messageId
          )

          // Fallback: If message not found by ID, try to find by position
          // This handles cases where AI SDK generates different IDs
          if (messageIndex === -1) {
            // For assistant message regeneration: find the last assistant message
            const lastAssistantIndex = currentChat.messages.findLastIndex(
              m => m.role === 'assistant'
            )

            // For user message edit: find the last user message
            const lastUserIndex = currentChat.messages.findLastIndex(
              m => m.role === 'user'
            )

            // Use the most recent message (either user or assistant)
            if (lastAssistantIndex >= 0 || lastUserIndex >= 0) {
              messageIndex = Math.max(lastAssistantIndex, lastUserIndex)
            } else {
              throw new Error(
                `Message ${messageId} not found and no fallback available`
              )
            }
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

        // Create a promise to track when research finishes
        const researchPromise = new Promise<void>(resolve => {
          writer.merge(
            researchResult.toUIMessageStream({
              sendFinish: false,
              onFinish: ({ responseMessage }) => {
                researchMessage = responseMessage
                resolve()
              }
            })
          )
        })

        // Wait for research to complete
        await researchPromise

        // Check if we have a valid research message
        if (!researchMessage) {
          writer.write({ type: 'finish' })
          return
        }

        // At this point, TypeScript should know researchMessage is not null
        const validResearchMessage: UIMessage = researchMessage

        // Check if the research message contains tool calls
        const hasToolCallsInMessage = hasToolCalls(validResearchMessage)

        // If no tool calls (just answering), skip related questions
        if (!hasToolCallsInMessage) {
          // Save research message
          await saveMessage(chatId, validResearchMessage)

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

          // Send a finish message to complete the stream
          writer.write({ type: 'finish' })
          return
        }

        // If we have tool calls, proceed with related questions generation
        try {
          // Get the research data
          const researchData = await researchResult.response

          // Check if request was aborted
          if (researchData.messages.length === 0) {
            writer.write({ type: 'finish' })
            return
          }

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

          // Create a promise to track when related questions finish
          const relatedQuestionsPromise = new Promise<void>(resolve => {
            writer.merge(
              relatedQuestionsResult.toUIMessageStream({
                sendStart: false,
                onFinish: ({ responseMessage }) => {
                  relatedQuestionsMessage = responseMessage
                  resolve()
                }
              })
            )
          })

          // Wait for related questions to complete
          await relatedQuestionsPromise

          // Save the complete message after both agents finish
          if (validResearchMessage && relatedQuestionsMessage) {
            const mergedMessage = mergeUIMessages(
              validResearchMessage,
              relatedQuestionsMessage
            )
            await saveMessage(chatId, mergedMessage)
          } else if (validResearchMessage) {
            // Save research message only if related questions failed
            await saveMessage(chatId, validResearchMessage)
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
        } catch (error) {
          console.error('Error generating related questions:', error)
          // Save research message even if related questions fail
          await saveMessage(chatId, validResearchMessage)
        }
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
