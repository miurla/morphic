import type { ModelMessage, UIMessage, UIMessageStreamWriter } from 'ai'

import type { researcher } from '@/lib/agents/researcher'
import { hasToolCalls } from '@/lib/utils/message-utils'

/**
 * Streams the initial response from the research agent
 * Returns the response messages for use in follow-up operations
 */
export async function streamInitialResponse(
  researchAgent: ReturnType<typeof researcher>,
  modelMessages: ModelMessage[],
  writer: UIMessageStreamWriter
): Promise<{
  responseMessage: UIMessage | null
  isAborted: boolean
  hasTools: boolean
}> {
  // Stream the initial response
  const streamResult = researchAgent.stream({ messages: modelMessages })

  // Track the response message
  let responseMessage: UIMessage | null = null
  let isAborted = false

  // Merge the stream into the UIMessageStream
  writer.merge(
    streamResult.toUIMessageStream({
      onFinish: async ({ responseMessage: msg, isAborted: aborted }) => {
        responseMessage = msg
        isAborted = aborted
      }
    })
  )

  // Wait for the stream to complete
  await streamResult.consumeStream()

  return {
    responseMessage,
    isAborted,
    hasTools: responseMessage ? hasToolCalls(responseMessage) : false
  }
}
