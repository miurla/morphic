import {
  convertToCoreMessages,
  createDataStreamResponse,
  DataStreamWriter,
  JSONValue,
  smoothStream,
  streamText
} from 'ai'
import { ExtendedCoreMessage } from '../types'
import { getModel } from '../utils/registry'
import { handleStreamFinish } from './handle-stream-finish'
import { executeToolCall } from './tool-execution'
import { BaseStreamConfig } from './types'

export function createManualToolStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      try {
        const coreMessages = convertToCoreMessages(config.messages)
        const model = getModel(config.model)

        const { toolCallDataAnnotation, toolCallMessages } =
          await executeToolCall(coreMessages, dataStream)

        const result = streamText({
          model,
          system:
            'You are a helpful assistant. You received a search results. You must use the search results to answer the user question.',
          messages: [...coreMessages, ...toolCallMessages],
          experimental_transform: smoothStream({
            chunking: 'word'
          }),
          onFinish: async result => {
            const annotations: ExtendedCoreMessage[] = [
              ...(toolCallDataAnnotation ? [toolCallDataAnnotation] : []),
              {
                role: 'data',
                content: {
                  type: 'reasoning',
                  data: result.reasoning
                } as JSONValue
              }
            ]

            await handleStreamFinish({
              responseMessages: result.response.messages,
              originalMessages: config.messages,
              model: config.model,
              chatId: config.chatId,
              dataStream,
              skipRelatedQuestions: true,
              annotations
            })
          }
        })

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true
        })
      } catch (error) {
        console.error('Stream execution error:', error)
      }
    },
    onError: error => {
      console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}
