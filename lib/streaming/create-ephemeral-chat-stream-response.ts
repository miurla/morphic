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
import { getTextFromParts } from '../utils/message-utils'
import { isUsageLogging, logUsage } from '../utils/usage-logging'

import { buildAttachmentTokenEstimates } from './helpers/attachment-token-estimates'
import { capHistoricalAttachments } from './helpers/cap-historical-attachments'
import { compactHistoricalMessages } from './helpers/compact-historical-messages'
import { convertDataPart } from './helpers/convert-data-part'
import { assignDataPartNonces } from './helpers/data-part-nonce'
import { dedupeAttachments } from './helpers/dedupe-attachments'
import { describeTurnInput } from './helpers/describe-turn-input'
import {
  EMPTY_RESPONSE_STATUS_MESSAGE,
  isEmptyResponse
} from './helpers/is-empty-response'
import { logAPICallErrorDiagnostics } from './helpers/log-api-call-error'
import {
  buildStreamErrorSpanUpdate,
  type StreamErrorPhase,
  type StreamErrorStage
} from './helpers/stream-error-diagnostics'
import { stripSpecFromMessages } from './helpers/strip-spec-from-messages'
import { summarizeCarriedContext } from './helpers/summarize-carried-context'
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
    // The agent stream call is preparation until its first generation starts.
    let streamErrorPhase: StreamErrorPhase = 'preparation'
    let streamErrorStage: StreamErrorStage = 'transform-messages'
    // Sampled where the failure happens: the client can disconnect before the
    // span is closed, and by then the signal no longer says whether the user
    // cancelled this turn or the failure was the model's own.
    let streamErrorWasCancelled = false
    // Overall IO of the trace lives on the root observation. The turn is driven
    // by the last user message of the submitted history.
    const rootInput = describeTurnInput(
      messages.findLast(m => m.role === 'user')?.parts
    )
    let rootOutput: string | undefined
    let carriedContext: Record<string, number> | undefined
    let contextWindowTruncated = false

    const endTracing = async () => {
      if (rootSpan) {
        const failureUpdate = hasStreamError
          ? buildStreamErrorSpanUpdate(streamError, {
              requestWasCancelled: streamErrorWasCancelled,
              phase: streamErrorPhase,
              stage: streamErrorStage
            })
          : hasEmptyResponse
            ? {
                level: 'ERROR' as const,
                statusMessage: EMPTY_RESPONSE_STATUS_MESSAGE
              }
            : null
        // A turn that failed mid-answer or produced no answer text still has
        // whatever was streamed before it. That is not the turn's answer, so
        // it is not recorded as one.
        const hasAnswer = !hasStreamError && !hasEmptyResponse
        // A failure update carries its own metadata (#945), so the two are
        // merged rather than spread as siblings: whichever came last would
        // otherwise drop the other one entirely.
        const failureMetadata =
          failureUpdate && 'metadata' in failureUpdate
            ? failureUpdate.metadata
            : undefined
        const metadata = {
          ...(carriedContext !== undefined && { carriedContext }),
          ...(contextWindowTruncated && { contextWindowTruncated }),
          ...failureMetadata
        }
        const update = {
          ...(rootInput !== undefined && { input: rootInput }),
          ...(hasAnswer && rootOutput !== undefined && { output: rootOutput }),
          ...failureUpdate,
          ...(Object.keys(metadata).length > 0 && { metadata })
        }
        if (Object.keys(update).length > 0) rootSpan.update(update)
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
      carriedContext = summarizeCarriedContext(messagesToConvert)
      const attachmentTokenEstimates =
        buildAttachmentTokenEstimates(messagesToConvert)

      streamErrorStage = 'convert-messages'
      let modelMessages = await convertToModelMessages(messagesToConvert, {
        convertDataPart
      })

      streamErrorStage = 'truncate-messages'
      if (
        shouldTruncateMessages(modelMessages, model, attachmentTokenEstimates)
      ) {
        const maxTokens = getMaxAllowedTokens(model)
        modelMessages = truncateMessages(
          modelMessages,
          maxTokens,
          model.id,
          attachmentTokenEstimates
        )
        contextWindowTruncated = true
      }

      streamErrorStage = 'build-agent'
      const researchAgent = researcher({
        model: `${model.providerId}:${model.id}`,
        modelConfig: model,
        chatId,
        searchMode
      })

      const modelId = `${model.providerId}:${model.id}`
      streamErrorStage = 'start-stream'
      // AgentStreamParameters omits onError, but it reaches streamText where only
      // stream errors, not recoverable tool errors, invoke it.
      const result = await researchAgent.stream({
        messages: modelMessages,
        abortSignal,
        onError: ({ error }) => {
          hasStreamError = true
          streamError = error
          streamErrorWasCancelled = abortSignal?.aborted ?? false
          streamErrorPhase = 'generation'
        },
        experimental_transform: smoothStream({ chunking: 'word' }),
        ...(isUsageLogging() && {
          onStepEnd: step => {
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
        Promise.resolve(result.usage)
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
        onEnd: async ({ responseMessage, isAborted }) => {
          if (!isAborted && responseMessage) {
            rootOutput = getTextFromParts(responseMessage.parts) || undefined
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
