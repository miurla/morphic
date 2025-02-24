import { CoreMessage } from 'ai'
import { Model } from '../types/models'

const DEFAULT_CONTEXT_WINDOW = 128_000
const DEFAULT_RESERVE_TOKENS = 30_000

export function getMaxAllowedTokens(model: Model): number {
  let contextWindow: number
  let reserveTokens: number

  if (model.id.includes('deepseek')) {
    contextWindow = 64_000
    reserveTokens = 27_000
  } else if (model.id.includes('claude')) {
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
  maxTokens: number
): CoreMessage[] {
  let totalTokens = 0
  const tempMessages: CoreMessage[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const messageTokens = message.content?.length || 0

    if (totalTokens + messageTokens <= maxTokens) {
      tempMessages.push(message)
      totalTokens += messageTokens
    } else {
      break
    }
  }

  const orderedMessages = tempMessages.reverse()

  while (orderedMessages.length > 0 && orderedMessages[0].role !== 'user') {
    orderedMessages.shift()
  }

  return orderedMessages
}
