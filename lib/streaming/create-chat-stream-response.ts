import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
  UIMessageStreamWriter
} from 'ai'
import { randomUUID } from 'crypto'
import { Langfuse } from 'langfuse'

import { researcher } from '@/lib/agents/researcher'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import { loadChat } from '../actions/chat'
import { generateChatTitle } from '../agents/title-generator'
import {
  getMaxAllowedTokens,
  shouldTruncateMessages,
  truncateMessages
} from '../utils/context-window'
import { getTextFromParts } from '../utils/message-utils'
import { perfLog, perfTime } from '../utils/perf-logging'

import { filterReasoningParts } from './helpers/filter-reasoning-parts'
import { persistStreamResults } from './helpers/persist-stream-results'
import { prepareMessages } from './helpers/prepare-messages'
import { streamRelatedQuestions } from './helpers/stream-related-questions'
import type { StreamContext } from './helpers/types'
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
    userId,
    trigger,
    messageId,
    abortSignal,
    isNewChat,
    searchMode
  } = config

  // Verify that chatId is provided
  if (!chatId) {
    return new Response('Chat ID is required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  // Skip loading chat for new chats optimization
  let initialChat = null
  if (!isNewChat) {
    const loadChatStart = performance.now()
    // Fetch chat data for authorization check and cache it
    initialChat = await loadChat(chatId, userId)
    perfTime('loadChat completed', loadChatStart)

    // Authorization check: if chat exists, it must belong to the user
    if (initialChat && initialChat.userId !== userId) {
      return new Response('You are not allowed to access this chat', {
        status: 403,
        statusText: 'Forbidden'
      })
    }
  } else {
    perfLog('loadChat skipped for new chat')
  }

  // Create parent trace ID for grouping all operations
  let parentTraceId: string | undefined
  let langfuse: Langfuse | undefined

  if (isTracingEnabled()) {
    parentTraceId = randomUUID()
    langfuse = new Langfuse()

    // Create parent trace with name "research"
    langfuse.trace({
      id: parentTraceId,
      name: 'research',
      metadata: {
        chatId,
        userId,
        modelId: `${model.providerId}:${model.id}`,
        trigger
      }
    })
  }

  // Create stream context with trace ID
  const context: StreamContext = {
    chatId,
    userId,
    modelId: `${model.providerId}:${model.id}`,
    messageId,
    trigger,
    initialChat,
    abortSignal,
    parentTraceId, // Add parent trace ID to context
    isNewChat
  }

  // Declare titlePromise in outer scope for onFinish access
  let titlePromise: Promise<string> | undefined

  // Create the stream
  const stream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      try {
        // Prepare messages for the model
        const prepareStart = performance.now()
        perfLog(
          `prepareMessages - Invoked: trigger=${trigger}, isNewChat=${isNewChat}`
        )
        const messagesToModel = await prepareMessages(context, message)
        perfTime('prepareMessages completed (stream)', prepareStart)

        // Get the researcher agent with parent trace ID and search mode
        const researchAgent = researcher({
          model: context.modelId,
          modelConfig: model,
          abortSignal,
          writer,
          parentTraceId,
          searchMode
        })

        // Filter out reasoning parts from messages before converting to model messages
        // OpenAI API requires reasoning messages to be followed by assistant messages
        const filteredMessages = filterReasoningParts(messagesToModel)

        // Convert to model messages and apply context window management
        let modelMessages = convertToModelMessages(filteredMessages)

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
        if (!initialChat && message) {
          const userContent = getTextFromParts(message.parts)
          titlePromise = generateChatTitle({
            userMessageContent: userContent,
            modelId: context.modelId,
            abortSignal,
            parentTraceId
          }).catch(error => {
            console.error('Error generating title:', error)
            return DEFAULT_CHAT_TITLE
          })
        }

        const llmStart = performance.now()
        perfLog(
          `researchAgent.stream - Start: model=${context.modelId}, searchMode=${searchMode}`
        )
        const result = researchAgent.stream({ messages: modelMessages })
        result.consumeStream()
        // Stream with the research agent, including metadata
        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) => {
              // Send metadata when streaming starts
              if (part.type === 'start') {
                return {
                  traceId: parentTraceId,
                  searchMode,
                  modelId: context.modelId
                }
              }
            }
          })
        )

        const responseMessages = (await result.response).messages
        perfTime('researchAgent.stream completed', llmStart)
        // Generate related questions
        if (responseMessages && responseMessages.length > 0) {
          // Find the last user message
          const lastUserMessage = [...modelMessages]
            .reverse()
            .find(msg => msg.role === 'user')
          const messagesForQuestions = lastUserMessage
            ? [lastUserMessage, ...responseMessages]
            : responseMessages

          await streamRelatedQuestions(
            writer,
            messagesForQuestions,
            abortSignal,
            parentTraceId
          )
        }
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error // This error will be handled by the onError callback
      } finally {
        // Flush Langfuse traces if enabled
        if (langfuse) {
          await langfuse.flushAsync()
        }
      }
    },
    onError: (error: any) => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage) return

      // Persist stream results to database
      await persistStreamResults(
        responseMessage,
        chatId,
        userId,
        titlePromise,
        parentTraceId,
        searchMode,
        context.modelId
      )
    }
  })

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream
  })
}
