import { tool } from 'ai'
import { z } from 'zod'

export const askQuestionTool = tool({
  description:
    'Ask a clarifying question with multiple options when more information is needed',
  parameters: z.object({
    question: z.string().describe('The main question to ask the user'),
    options: z
      .array(
        z.object({
          value: z.string().describe('Option identifier (always in English)'),
          label: z.string().describe('Display text for the option')
        })
      )
      .describe('List of predefined options'),
    allowsInput: z.boolean().describe('Whether to allow free-form text input'),
    inputLabel: z
      .string()
      .optional()
      .describe('Label for free-form input field'),
    inputPlaceholder: z
      .string()
      .optional()
      .describe('Placeholder text for input field')
  })
  // execute function removed to enable frontend confirmation
})
