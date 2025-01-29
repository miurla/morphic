import { openai } from '@ai-sdk/openai'
import {
  convertToCoreMessages,
  CoreMessage,
  createDataStreamResponse,
  DataStreamWriter,
  generateId,
  generateText,
  JSONValue,
  smoothStream,
  streamText
} from 'ai'
import { z } from 'zod'
import { searchSchema } from '../schema/search'
import { search } from '../tools/search'
import { ExtendedCoreMessage } from '../types'
import { getModel } from '../utils/registry'
import { handleStreamFinish } from './handle-stream-finish'
import { parseToolCallXml } from './parse-tool-call'
import { BaseStreamConfig } from './types'

export function createManualToolStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      try {
        const coreMessages = convertToCoreMessages(config.messages)
        const model = getModel(config.model)
        const toolCallModel = openai('gpt-4o-mini')

        // Convert Zod schema to string representation
        const searchSchemaString = Object.entries(searchSchema.shape)
          .map(([key, value]) => {
            const description = value.description
            const isOptional = value instanceof z.ZodOptional
            return `- ${key}${isOptional ? ' (optional)' : ''}: ${description}`
          })
          .join('\n')

        // Generate tool selection using XML format
        const toolSelectionResponse = await generateText({
          model: toolCallModel,
          system: `You are a helpful assistant that selects appropriate tools and their parameters.
                  Do not include any other text in your response.
                  Respond in XML format with the following structure:
                  <tool_call>
                    <tool>tool_name</tool>
                    <parameters>
                      <query>search query text</query>
                      <max_results>number - 20 by default</max_results>
                      <search_depth>basic or advanced</search_depth>
                      <include_domains>domain1,domain2</include_domains>
                      <exclude_domains>domain1,domain2</exclude_domains>
                    </parameters>
                  </tool_call>

                  Available tools: search

                  Search parameters:
                  ${searchSchemaString}

                  If you don't need a tool, respond with <tool_call><tool></tool></tool_call>`,
          messages: coreMessages
        })

        // Add debug log
        console.log('Raw XML response:', toolSelectionResponse.text)

        // Parse the tool selection XML using the search schema
        const toolCall = parseToolCallXml(
          toolSelectionResponse.text,
          searchSchema
        )
        console.log('Parsed tool call:', toolCall)

        let toolCallMessages: CoreMessage[] = []
        let toolCallDataAnnotation: ExtendedCoreMessage | null = null

        if (toolCall && toolCall.tool !== '') {
          const toolCallAnnotation = {
            type: 'tool_call',
            data: {
              state: 'call',
              toolCallId: `call_${generateId()}`,
              toolName: toolCall.tool,
              args: JSON.stringify(toolCall.parameters)
            }
          }
          dataStream.writeData(toolCallAnnotation)

          let toolCallResult: JSONValue = {}
          if (toolCall.tool === 'search') {
            toolCallResult = await search(
              toolCall.parameters?.query ?? '',
              toolCall.parameters?.max_results,
              toolCall.parameters?.search_depth as 'basic' | 'advanced',
              toolCall.parameters?.include_domains,
              toolCall.parameters?.exclude_domains
            )
          } else {
            throw new Error('Invalid tool name')
          }

          const updatedToolCallAnnotation = {
            ...toolCallAnnotation,
            data: {
              ...toolCallAnnotation.data,
              result: JSON.stringify(toolCallResult),
              state: 'result'
            }
          }
          dataStream.writeMessageAnnotation(updatedToolCallAnnotation)

          toolCallDataAnnotation = {
            role: 'data',
            content: {
              type: 'tool_call',
              data: updatedToolCallAnnotation.data
            }
          }

          toolCallMessages = [
            {
              role: 'assistant' as const,
              content: `Tool call result: ${JSON.stringify(toolCallResult)}`
            },
            {
              role: 'user' as const,
              content: 'Now answer the user question.'
            }
          ]
        }

        // Proceed with the main stream
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
