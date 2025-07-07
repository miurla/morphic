import { educationalInstructor } from '@/lib/agents/educational-instructor'
import { researcher } from '@/lib/agents/researcher'
import {
  convertToCoreMessages,
  CoreMessage,
  createDataStreamResponse,
  DataStreamWriter,
  streamText
} from 'ai'
import { getMaxAllowedTokens, truncateMessages } from '../utils/context-window'
import { isReasoningModel } from '../utils/registry'
import { handleStreamFinish } from './handle-stream-finish'
import { BaseStreamConfig } from './types'

// Function to check if a message contains ask_question tool invocation
function containsAskQuestionTool(message: CoreMessage) {
  // For CoreMessage format, we check the content array
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return false
  }

  // Check if any content item is a tool-call with ask_question tool
  return message.content.some(
    item => item.type === 'tool-call' && item.toolName === 'ask_question'
  )
}

// Function to detect if the conversation contains educational intent
function detectEducationalIntent(messages: CoreMessage[]): boolean {
  const educationalKeywords = [
    'learn', 'teach', 'tutorial', 'lesson', 'course', 'programming', 'coding',
    'javascript', 'python', 'html', 'css', 'web development', 'practice',
    'exercise', 'challenge', 'guide', 'explain', 'show me how', 'help me understand',
    'educational', 'instruction', 'demo', 'example', 'interactive'
  ]
  
  // Check recent messages for educational intent
  const recentMessages = messages.slice(-3) // Last 3 messages
  
  return recentMessages.some(message => {
    if (message.role === 'user' && typeof message.content === 'string') {
      const content = message.content.toLowerCase()
      return educationalKeywords.some(keyword => content.includes(keyword))
    }
    return false
  })
}

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages, model, chatId, searchMode, userId } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const coreMessages = convertToCoreMessages(messages)
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(model)
        )

        // Detect educational intent and choose appropriate agent
        const isEducationalRequest = detectEducationalIntent(truncatedMessages)
        
        let agentConfig
        if (isEducationalRequest) {
          // Use educational instructor for learning-related requests
          agentConfig = educationalInstructor({
            messages: truncatedMessages,
            model: modelId,
            lessonMode: true
          })
        } else {
          // Use researcher for general questions and search
          agentConfig = await researcher({
            messages: truncatedMessages,
            model: modelId,
            searchMode
          })
        }

        const result = streamText({
          ...agentConfig,
          onFinish: async result => {
            // Check if the last message contains an ask_question tool invocation
            const shouldSkipRelatedQuestions =
              isReasoningModel(modelId) ||
              (result.response.messages.length > 0 &&
                containsAskQuestionTool(
                  result.response.messages[
                    result.response.messages.length - 1
                  ] as CoreMessage
                ))

            await handleStreamFinish({
              responseMessages: result.response.messages,
              originalMessages: messages,
              model: modelId,
              chatId,
              dataStream,
              userId,
              skipRelatedQuestions: shouldSkipRelatedQuestions
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
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}
