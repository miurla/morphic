import { DeepPartial } from 'ai'
import { z } from 'zod'

export const fetchSchema = z.object({
  url: z
    .string()
    .describe('An absolute http:// or https:// URL to retrieve content from'),
  type: z
    .enum(['regular', 'api'])
    .default('regular')
    .describe(
      'Fetch method: "regular" (default) = fast direct HTML fetch for simple web pages (does NOT support PDFs), "api" = advanced extraction for PDFs and complex JavaScript-rendered pages (requires Jina or Tavily API keys)'
    )
})

export const crawl4aiFetchSchema = fetchSchema.extend({
  type: z
    .enum(['regular', 'api'])
    .default('regular')
    .describe(
      'Fetch method: "regular" (default) and "api" behave the same, and both support PDFs'
    )
})

export type PartialInquiry = DeepPartial<typeof fetchSchema>
