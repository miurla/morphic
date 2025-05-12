import { researcher } from '@/lib/agents/researcher'
import { openai } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  createDataStream,
  createDataStreamResponse,
  ModelMessage,
  streamText
} from 'ai'
import { getMaxAllowedTokens, truncateMessages } from '../utils/context-window'
import { BaseStreamConfig } from './types'

// Function to check if a message contains ask_question tool invocation
function containsAskQuestionTool(message: ModelMessage) {
  // For ModelMessage format, we check the content array
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return false
  }

  // Check if any content item is a tool-call with ask_question tool
  return message.content.some(
    item => item.type === 'tool-call' && item.toolName === 'ask_question'
  )
}

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  const dataStream = createDataStream({
    execute: async writer => {
      const { messages, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const modelMessages = convertToModelMessages(messages)
        const truncatedMessages = truncateMessages(
          modelMessages,
          getMaxAllowedTokens(model)
        )

        let researcherConfig = await researcher({
          messages: truncatedMessages,
          model: modelId,
          searchMode
        })

        const result = streamText({
          // ...researcherConfig,
          model: openai('gpt-4o-mini'),
          system: 'You are a helpful assistant.',
          prompt: 'Hello',
          onError: error => {
            console.error('Stream error:', error)
          },
          onChunk: chunk => {
            console.log('Chunk:', chunk)
          }
        })
        writer.merge(result.toDataStream())
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error
      }
    },
    onError: error => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })

  return createDataStreamResponse({ dataStream })
}
