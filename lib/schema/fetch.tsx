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
      'Fetch method: "regular" (default) = fast direct HTML fetch for simple web pages, "api" = advanced extraction for complex JavaScript-rendered pages. PDF support depends on the configured extraction backend; the tool description states the current behavior.'
    )
})

export type PartialInquiry = DeepPartial<typeof fetchSchema>
