import { DeepPartial } from 'ai'
import { z } from 'zod'

export const searchSchema = z.object({
  query: z.string().describe('The query to search for'),
  max_results: z.number().describe('The maximum number of results to return'),
  search_depth: z
    .enum(['basic', 'advanced'])
    .describe('The depth of the search')
})

export type PartialInquiry = DeepPartial<typeof searchSchema>
