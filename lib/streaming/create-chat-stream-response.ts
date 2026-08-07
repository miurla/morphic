import type { LangfuseSpan } from '@langfuse/tracing'
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing'
import type { StreamTextOnErrorCallback } from 'ai'
import { consumeStream, convertToModelMessages, smoothStream } from 'ai'

import { researcher } from '@/lib/agents/researcher'
import {
  createPublicErrorResponse,
  serializePublicError
} from '@/lib/errors/public-error'
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
import { isUsageLogging, logUsage } from '../utils/usage-logging'

import { capHistoricalAttachments } from './helpers/cap-historical-attachments'
import { compactHistoricalMessages } from './helpers/compact-historical-messages'
import { convertDataPart } from './helpers/convert-data-part'
import { assignDataPartNonces } from './helpers/data-part-nonce'
import { describeStreamError } from './helpers/describe-stream-error'
import {
  EMPTY_RESPONSE_STATUS_MESSAGE,
  isEmptyResponse
} from './helpers/is-empty-response'
import {
  buildAPICallErrorDiagnostics,
  logAPICallErrorDiagnostics
} from './helpers/log-api-call-error'
import { persistStreamResults } from './helpers/persist-stream-results'
import { prepareMessages } from './helpers/prepare-messages'
import { stripSpecFromMessages } from './helpers/strip-spec-from-messages'
import type { StreamContext } from './helpers/types'
import { BaseStreamConfig } from './types'

import { langfuseSpanProcessor } from '@/instrumentation'

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

  const executeStream = async (rootSpan?: LangfuseSpan): Promise<Response> => {
    // Real OTel trace ID, stored in message metadata so feedback scores can
    // be attached to this trace later
    const parentTraceId = rootSpan?.traceId
    let hasStreamError = false
    let hasEmptyResponse = false
    let streamError: unknown

    const endTracing = async () => {
      if (rootSpan) {
        if (hasStreamError) {
          const apiCallDiagnostics = buildAPICallErrorDiagnostics(streamError)
          rootSpan.update({
            level: 'ERROR',
            statusMessage: describeStreamError(streamError),
            ...(apiCallDiagnostics && { metadata: { apiCallDiagnostics } })
          })
        } else if (hasEmptyResponse) {
          rootSpan.update({
            level: 'ERROR',
            statusMessage: EMPTY_RESPONSE_STATUS_MESSAGE
          })
        }
        rootSpan.end()
        await langfuseSpanProcessor.forceFlush()
      }
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
      parentTraceId,
      isNewChat
    }

    // Declare titlePromise in outer scope for onFinish access
    let titlePromise: Promise<string> | undefined

    try {
      // Prepare messages for the model
      const prepareStart = performance.now()
      perfLog(
        `prepareMessages - Invoked: trigger=${trigger}, isNewChat=${isNewChat}`
      )
      const messagesToModel = await prepareMessages(context, message)
      perfTime('prepareMessages completed (stream)', prepareStart)

      // Get the researcher agent with search mode
      const researchAgent = researcher({
        model: context.modelId,
        modelConfig: model,
        searchMode
      })

      const messagesWithNonces = assignDataPartNonces(messagesToModel)
      const messagesWithoutSpec = stripSpecFromMessages(messagesWithNonces)
      const messagesToConvert = capHistoricalAttachments(
        compactHistoricalMessages(messagesWithoutSpec)
      )

      // Convert to model messages and apply context window management
      let modelMessages = await convertToModelMessages(messagesToConvert, {
        convertDataPart
      })

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
          abortSignal
        }).catch(error => {
          console.error('Error generating title:', error)
          return DEFAULT_CHAT_TITLE
        })
      }

      const llmStart = performance.now()
      perfLog(
        `researchAgent.stream - Start: model=${context.modelId}, searchMode=${searchMode}`
      )
      // AgentStreamParameters omits onError, but it reaches streamText where only
      // stream errors, not recoverable tool errors, invoke it.
      const result = await researchAgent.stream({
        messages: modelMessages,
        abortSignal,
        onError: ({ error }) => {
          hasStreamError = true
          streamError = error
        },
        experimental_transform: smoothStream({ chunking: 'word' }),
        ...(isUsageLogging() && {
          onStepFinish: step => {
            logUsage(
              { scope: 'step', modelId: context.modelId },
              step.usage,
              step.providerMetadata
            )
          }
        })
      } as Parameters<typeof researchAgent.stream>[0] & {
        onError: StreamTextOnErrorCallback
      })
      result.consumeStream()

      // Log the session-total usage once the stream settles (does not block the
      // response; consumeStream above already drives it to completion).
      if (isUsageLogging()) {
        Promise.resolve(result.totalUsage)
          .then(usage =>
            logUsage({ scope: 'total', modelId: context.modelId }, usage)
          )
          .catch(() => {})
      }

      return result.toUIMessageStreamResponse({
        messageMetadata: ({ part }) => {
          if (part.type === 'start') {
            return {
              traceId: parentTraceId,
              searchMode,
              modelId: context.modelId
            }
          }
        },
        onFinish: async ({ responseMessage, isAborted }) => {
          try {
            perfTime('researchAgent.stream completed', llmStart)
            if (isAborted || !responseMessage) return

            hasEmptyResponse = isEmptyResponse(responseMessage)

            // Persist stream results to database
            await persistStreamResults(
              responseMessage,
              chatId,
              userId,
              titlePromise,
              parentTraceId,
              searchMode,
              context.modelId,
              context.pendingInitialSave,
              context.pendingInitialUserMessage
            )
          } finally {
            await endTracing()
          }
        },
        onError: (error: unknown) => {
          logAPICallErrorDiagnostics(error)
          console.error('Stream response error:', error)
          return serializePublicError(error)
        },
        consumeSseStream: consumeStream
      })
    } catch (error) {
      hasStreamError = true
      streamError = error
      await endTracing()
      logAPICallErrorDiagnostics(error)
      console.error('Stream execution error:', error)
      return createPublicErrorResponse(error, {
        status: 500,
        statusText: 'Internal Server Error'
      })
    }
  }

  if (!isTracingEnabled()) {
    return executeStream()
  }

  // Wrap execution in a root Langfuse observation so the researcher and
  // title-generation spans share a single trace
  return propagateAttributes(
    {
      traceName: 'research',
      userId,
      sessionId: chatId,
      metadata: {
        chatId,
        userId,
        modelId: `${model.providerId}:${model.id}`,
        ...(trigger && { trigger })
      }
    },
    () =>
      startActiveObservation('research', span => executeStream(span), {
        endOnExit: false
      })
  )
}
