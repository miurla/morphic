import {
  consumeStream,
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
import { updateChatTitle } from '../db/actions'
import { generateId } from '../db/schema'
import {
  getMaxAllowedTokens,
  shouldTruncateMessages,
  truncateMessages
} from '../utils/context-window'
import { getTextFromParts, hasToolCalls } from '../utils/message-utils'
import { retryDatabaseOperation } from '../utils/retry'

import { BaseStreamConfig } from './types'

// Constants
const DEFAULT_CHAT_TITLE = 'Untitled'

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const {
    message,
    model,
    chatId,
    searchMode,
    userId,
    trigger,
    messageId,
    abortSignal
  } = config
  const modelId = `${model.providerId}:${model.id}`

  // Verify that chatId is provided
  if (!chatId) {
    return new Response('Chat ID is required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  // Fetch chat data for authorization check and cache it
  let initialChat = await getChatAction(chatId, userId)

  // Authorization check: if chat exists, it must belong to the user
  if (initialChat && initialChat.userId !== userId) {
    return new Response('You are not allowed to access this chat', {
      status: 403,
      statusText: 'Forbidden'
    })
  }

  // Create the stream
  const stream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      try {
        let messagesToModel: UIMessage[]

        if (trigger === 'regenerate-assistant-message' && messageId) {
          // Handle regeneration
          // Use cached chat data or fetch if not available
          const currentChat =
            initialChat || (await getChatAction(chatId, userId))
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
          if (!initialChat) {
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
          searchMode,
          abortSignal
        })

        // Convert to model messages and apply context window management
        let modelMessages = convertToModelMessages(messagesToModel)

        if (shouldTruncateMessages(modelMessages, model)) {
          const maxTokens = getMaxAllowedTokens(model)
          const originalCount = modelMessages.length
          modelMessages = truncateMessages(modelMessages, maxTokens, model.id)

          if (process.env.NODE_ENV === 'development') {
            console.log(
              `Context window limit reached. Truncating from ${originalCount} to ${modelMessages.length} messages`
            )
          }
        }

        // Start title generation in parallel if it's a new chat
        let titlePromise: Promise<string> | undefined
        if (!initialChat && message) {
          const userContent = getTextFromParts(message.parts)
          titlePromise = generateChatTitle({
            userMessageContent: userContent,
            modelId,
            abortSignal
          }).catch(error => {
            console.error('Error generating title:', error)
            return DEFAULT_CHAT_TITLE
          })
        }

        // Stream with the research agent
        writer.merge(
          researchAgent.stream({ messages: modelMessages }).toUIMessageStream({
            onFinish: async ({ responseMessage, isAborted }) => {
              if (isAborted || !responseMessage) return

              // Generate related questions if there are tool calls
              if (hasToolCalls(responseMessage)) {
                const questionPartId = generateId()

                try {
                  // Send initial loading state
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

                  // Add to message parts for saving (with actual data)
                  responseMessage.parts.push({
                    type: 'data-relatedQuestions',
                    id: questionPartId,
                    data: {
                      status: 'success',
                      questions: relatedQuestions.questions
                    }
                  })

                  // Update stream with actual data (same ID)
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
                  // Send error state with same ID
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

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream
  })
}
