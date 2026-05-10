import { z } from 'zod'

// Standard schema with optional fields for inputLabel and inputPlaceholder
function parseOptionsField(val: unknown): { value: string; label: string }[] {
  if (Array.isArray(val)) {
    return val.map((item: unknown) => {
      if (typeof item === 'string') return { value: item, label: item }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        return {
          value: String(o.value ?? o.label ?? ''),
          label: String(o.label ?? o.value ?? '')
        }
      }
      return { value: String(item), label: String(item) }
    })
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parseOptionsField(parsed)
    } catch {}
  }
  return []
}

export const questionSchema = z
  .object({
    question: z.string().describe('The main question to ask the user'),
    options: z
      .array(
        z.object({
          value: z.string(),
          label: z.string()
        })
      )
      .optional()
      .describe('List of predefined options as [{value, label}]'),
    answers: z.any().optional(),
    allowsInput: z
      .boolean()
      .default(false)
      .describe('Whether to allow free-form text input'),
    inputLabel: z
      .string()
      .optional()
      .describe('Label for free-form input field'),
    inputPlaceholder: z
      .string()
      .optional()
      .describe('Placeholder text for input field')
  })
  .transform(data => {
    const raw = data.options ?? data.answers
    return {
      question: data.question,
      options: parseOptionsField(raw),
      allowsInput: data.allowsInput,
      inputLabel: data.inputLabel,
      inputPlaceholder: data.inputPlaceholder
    }
  })

// Strict schema with all fields required, for specific models like o3-mini
export const strictQuestionSchema = z
  .object({
    question: z.string().describe('The main question to ask the user'),
    options: z
      .array(
        z.object({
          value: z.string(),
          label: z.string()
        })
      )
      .optional()
      .describe('List of predefined options as [{value, label}]'),
    answers: z.any().optional(),
    allowsInput: z.boolean().describe('Whether to allow free-form text input'),
    inputLabel: z.string().describe('Label for free-form input field'),
    inputPlaceholder: z.string().describe('Placeholder text for input field')
  })
  .transform(data => {
    const raw = data.options ?? data.answers
    return {
      question: data.question,
      options: parseOptionsField(raw),
      allowsInput: data.allowsInput,
      inputLabel: data.inputLabel,
      inputPlaceholder: data.inputPlaceholder
    }
  })

/**
 * Returns the appropriate question schema based on the full model name.
 * Uses the strict schema for OpenAI models starting with 'o'.
 */
export function getQuestionSchemaForModel(fullModel: string) {
  const [provider, modelName] = fullModel?.split(':') ?? []
  const useStrictSchema =
    (provider === 'openai' || provider === 'azure') &&
    modelName?.startsWith('o')
  return useStrictSchema ? strictQuestionSchema : questionSchema
}
