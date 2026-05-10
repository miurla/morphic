import { tool } from 'ai'

import { getQuestionSchemaForModel } from '@/lib/schema/question'

/**
 * Creates a question tool with the appropriate schema for the specified model.
 */
export function createQuestionTool(fullModel: string) {
  return tool({
    description:
      'Ask the user a clarifying question with clickable options. ' +
      'Parameters: question (string), options (array of {value: string, label: string}), ' +
      'allowsInput (boolean — set true to allow free text). ' +
      'Example: { "question": "Quel ton ?", "options": [{"value": "professional", "label": "Professionnel"}, {"value": "casual", "label": "Casual"}], "allowsInput": false }',
    inputSchema: getQuestionSchemaForModel(fullModel)
    // execute function removed to enable frontend confirmation
  })
}

// Default export for backward compatibility, using a default model
export const askQuestionTool = createQuestionTool('openai:gpt-4o-mini')
