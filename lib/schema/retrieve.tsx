import { DeepPartial } from 'ai'
import { z } from 'zod'

export const retrieveSchema = z.object({
  url: z.string().describe('The URL to retrieve content from'),
  type: z
    .enum(['regular', 'api'])
    .default('regular')
    .describe(
      'Fetch method: "regular" (default) = fast direct HTML fetch, "api" = advanced extraction for PDFs or complex pages (requires API keys)'
    )
})

export type PartialInquiry = DeepPartial<typeof retrieveSchema>
