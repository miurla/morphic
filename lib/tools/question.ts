import { getQuestionSchemaForModel } from '@/lib/schema/question'
import { tool } from 'ai'

/**
 * Creates a question tool with the appropriate schema for the specified model.
 */
export function createQuestionTool(fullModel: string) {
  return tool({
    description:
      'Ask a clarifying question with multiple options when more information is needed',
    parameters: getQuestionSchemaForModel(fullModel)
    // execute function removed to enable frontend confirmation
  })
}

// Default export for backward compatibility, using a default model
export const askQuestionTool = createQuestionTool('openai:gpt-4o-mini')
