import { z } from 'zod'

export const factCheckSchema = z.object({
  query: z
    .string()
    .describe('The query or statement to fact-check using Google Fact Check Tools API.'),
  languageCode: z
    .string()
    .optional()
    .describe('Restricts results to a specific language (e.g., "en", "es").')
})

export type FactCheckSchema = z.infer<typeof factCheckSchema>
