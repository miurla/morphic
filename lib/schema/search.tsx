import { DeepPartial } from 'ai'
import { z } from 'zod'

export const searchSchema = z.object({
  query: z.string().describe('The query to search for'),
  max_results: z.number().describe('The maximum number of results to return'),
  search_depth: z
    .enum(['basic', 'advanced'])
    .describe('The depth of the search'),
  include_domains: z
    .array(z.string())
    .optional()
    .describe(
      'A list of domains to specifically include in the search results. Default is None, which includes all domains.'
    ),
  exclude_domains: z
    .array(z.string())
    .optional()
    .describe(
      "A list of domains to specifically exclude from the search results. Default is None, which doesn't exclude any domains."
    )
})

export type PartialInquiry = DeepPartial<typeof searchSchema>
