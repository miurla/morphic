import { researcher } from '@/lib/agents/researcher'
import {
  convertToCoreMessages,
  createDataStreamResponse,
  DataStreamWriter,
  streamText
} from 'ai'
import { handleStreamFinish } from './handle-stream-finish'
import { BaseStreamConfig } from './types'

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages, model, chatId } = config

      try {
        const coreMessages = convertToCoreMessages(messages)

        let researcherConfig = await researcher({
          messages: coreMessages,
          model
        })

        const result = streamText({
          ...researcherConfig,
          onFinish: async result => {
            await handleStreamFinish({
              responseMessages: result.response.messages,
              originalMessages: messages,
              model,
              chatId,
              dataStream
            })
          }
        })

        result.mergeIntoDataStream(dataStream)
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error
      }
    },
    onError: error => {
      console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}
