import { CoreMessage } from 'ai'

const DEFAULT_CONTEXT_WINDOW = 128_000
const DEFAULT_RESERVE_TOKENS = 30_000

export function getMaxAllowedTokens(modelId: string): number {
  let contextWindow: number
  let reserveTokens: number

  if (modelId.includes('deepseek')) {
    contextWindow = 64_000
    reserveTokens = 27_000
  } else if (modelId.includes('claude')) {
    contextWindow = 200_000
    reserveTokens = 40_000
  } else {
    contextWindow = DEFAULT_CONTEXT_WINDOW
    reserveTokens = DEFAULT_RESERVE_TOKENS
  }

  return contextWindow - reserveTokens
}

export function truncateMessages(
  messages: CoreMessage[],
  maxTokens: number,
  preserveSystemMessage = true
): CoreMessage[] {
  let totalTokens = 0
  const truncatedMessages: CoreMessage[] = []

  if (preserveSystemMessage && messages.length > 0) {
    truncatedMessages.push(messages[0])
    totalTokens += messages[0].content?.length || 0
  }

  for (let i = messages.length - 1; i >= (preserveSystemMessage ? 1 : 0); i--) {
    const message = messages[i]
    const messageTokens = message.content?.length || 0

    if (totalTokens + messageTokens <= maxTokens) {
      truncatedMessages.unshift(message)
      totalTokens += messageTokens
    } else {
      break
    }
  }

  return truncatedMessages
}
