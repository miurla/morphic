import type { LangfuseSpan } from '@langfuse/tracing'
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing'
import type { StreamTextOnErrorCallback, UIMessage } from 'ai'
import { consumeStream, convertToModelMessages, smoothStream } from 'ai'

import { researcher } from '@/lib/agents/researcher'
import {
  createPublicErrorResponse,
  serializePublicError
} from '@/lib/errors/public-error'
import {
  isToolFailureError,
  serializeToolFailure
} from '@/lib/errors/tool-error'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import {
  getMaxAllowedTokens,
  shouldTruncateMessages,
  truncateMessages
} from '../utils/context-window'
import { isUsageLogging, logUsage } from '../utils/usage-logging'

import { capHistoricalAttachments } from './helpers/cap-historical-attachments'
import { compactHistoricalMessages } from './helpers/compact-historical-messages'
import { convertDataPart } from './helpers/convert-data-part'
import { assignDataPartNonces } from './helpers/data-part-nonce'
import { dedupeAttachments } from './helpers/dedupe-attachments'
import {
  EMPTY_RESPONSE_STATUS_MESSAGE,
  isEmptyResponse
} from './helpers/is-empty-response'
import { logAPICallErrorDiagnostics } from './helpers/log-api-call-error'
import { buildStreamErrorSpanUpdate } from './helpers/stream-error-diagnostics'
import { stripSpecFromMessages } from './helpers/strip-spec-from-messages'
import { BaseStreamConfig } from './types'

import { langfuseSpanProcessor } from '@/instrumentation'

type EphemeralStreamConfig = Pick<
  BaseStreamConfig,
  'model' | 'abortSignal' | 'searchMode'
> & {
  messages: UIMessage[]
  chatId?: string
}

export async function createEphemeralChatStreamResponse(
  config: EphemeralStreamConfig
): Promise<Response> {
  const { messages, model, abortSignal, searchMode, chatId } = config

  if (!messages || messages.length === 0) {
    return new Response('messages are required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  const executeStream = async (rootSpan?: LangfuseSpan): Promise<Response> => {
    // Real OTel trace ID, sent to the client in message metadata so feedback
    // scores can be attached to this trace later
    const parentTraceId = rootSpan?.traceId
    let hasStreamError = false
    let hasEmptyResponse = false
    let streamError: unknown
    // Sampled where the failure happens: the client can disconnect before the
    // span is closed, and by then the signal no longer says whether the user
    // cancelled this turn or the failure was the model's own.
    let streamErrorWasCancelled = false

    const endTracing = async () => {
      if (rootSpan) {
        if (hasStreamError) {
          const update = buildStreamErrorSpanUpdate(
            streamError,
            streamErrorWasCancelled
          )
          if (update) rootSpan.update(update)
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

    try {
      const messagesWithNonces = assignDataPartNonces(messages)
      const messagesWithoutSpec = stripSpecFromMessages(messagesWithNonces)
      const messagesToConvert = dedupeAttachments(
        capHistoricalAttachments(compactHistoricalMessages(messagesWithoutSpec))
      )

      let modelMessages = await convertToModelMessages(messagesToConvert, {
        convertDataPart
      })

      if (shouldTruncateMessages(modelMessages, model)) {
        const maxTokens = getMaxAllowedTokens(model)
        modelMessages = truncateMessages(modelMessages, maxTokens, model.id)
      }

      const researchAgent = researcher({
        model: `${model.providerId}:${model.id}`,
        modelConfig: model,
        chatId,
        searchMode
      })

      const modelId = `${model.providerId}:${model.id}`
      // AgentStreamParameters omits onError, but it reaches streamText where only
      // stream errors, not recoverable tool errors, invoke it.
      const result = await researchAgent.stream({
        messages: modelMessages,
        abortSignal,
        onError: ({ error }) => {
          hasStreamError = true
          streamError = error
          streamErrorWasCancelled = abortSignal?.aborted ?? false
        },
        experimental_transform: smoothStream({ chunking: 'word' }),
        ...(isUsageLogging() && {
          onStepFinish: step => {
            logUsage(
              { scope: 'step', modelId },
              step.usage,
              step.providerMetadata
            )
          }
        })
      } as Parameters<typeof researchAgent.stream>[0] & {
        onError: StreamTextOnErrorCallback
      })
      result.consumeStream()

      if (isUsageLogging()) {
        Promise.resolve(result.totalUsage)
          .then(usage => logUsage({ scope: 'total', modelId }, usage))
          .catch(() => {})
      }

      return result.toUIMessageStreamResponse({
        messageMetadata: ({ part }) => {
          if (part.type === 'start') {
            return {
              traceId: parentTraceId,
              searchMode,
              modelId: `${model.providerId}:${model.id}`
            }
          }
        },
        onFinish: async ({ responseMessage, isAborted }) => {
          if (!isAborted && responseMessage) {
            hasEmptyResponse = isEmptyResponse(responseMessage)
          }
          await endTracing()
        },
        onError: (error: unknown) => {
          if (isToolFailureError(error)) {
            console.error('Ephemeral tool failure:', error)
            return serializeToolFailure(error)
          }

          logAPICallErrorDiagnostics(error)
          console.error('Ephemeral stream response error:', error)
          return serializePublicError(error)
        },
        consumeSseStream: consumeStream
      })
    } catch (error) {
      hasStreamError = true
      streamError = error
      streamErrorWasCancelled = abortSignal?.aborted ?? false
      await endTracing()
      logAPICallErrorDiagnostics(error)
      console.error('Ephemeral stream execution error:', error)
      return createPublicErrorResponse(error, {
        status: 500,
        statusText: 'Internal Server Error'
      })
    }
  }

  if (!isTracingEnabled()) {
    return executeStream()
  }

  // Wrap execution in a root Langfuse observation so all spans share a
  // single trace
  return propagateAttributes(
    {
      traceName: 'research',
      userId: 'guest',
      ...(chatId && { sessionId: chatId }),
      metadata: {
        ...(chatId && { chatId }),
        userId: 'guest',
        modelId: `${model.providerId}:${model.id}`,
        trigger: 'submit-message'
      }
    },
    () =>
      startActiveObservation('research', span => executeStream(span), {
        endOnExit: false
      })
  )
}
