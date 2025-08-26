import { convertToModelMessages, generateObject, type UIMessage } from 'ai'
import { z } from 'zod'

import { RELATED_QUESTIONS_MODEL_CONFIG } from '../config/model-types'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import { RELATED_QUESTIONS_PROMPT } from './prompts/related-questions-prompt'

const relatedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string()
      })
    )
    .length(3)
})

export async function generateRelatedQuestions(
  messages: UIMessage[],
  abortSignal?: AbortSignal,
  parentTraceId?: string
) {
  // Use the related questions model configuration
  const modelId = `${RELATED_QUESTIONS_MODEL_CONFIG.providerId}:${RELATED_QUESTIONS_MODEL_CONFIG.id}`

  // Convert UIMessages to ModelMessages
  const modelMessages = convertToModelMessages(messages)

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: relatedQuestionsSchema,
    schemaName: 'RelatedQuestions',
    schemaDescription:
      'Generate 3 concise follow-up questions (max 10-12 words each)',
    system: RELATED_QUESTIONS_PROMPT,
    messages: [
      ...modelMessages,
      {
        role: 'user',
        content:
          'Based on the conversation history and search results, generate 3 unique follow-up questions that would help the user explore different aspects of the topic. Focus on questions that dig deeper into specific findings or explore related areas not yet covered.'
      }
    ],
    abortSignal,
    experimental_telemetry: {
      isEnabled: isTracingEnabled(),
      functionId: 'related-questions',
      metadata: {
        modelId,
        agentType: 'related-questions-generator',
        messageCount: messages.length,
        ...(parentTraceId && {
          langfuseTraceId: parentTraceId,
          langfuseUpdateParent: false
        })
      }
    }
  })

  return object
}
