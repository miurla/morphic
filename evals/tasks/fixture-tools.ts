import { tool } from 'ai'
import { z } from 'zod'

import { fetchTool } from '@/lib/tools/fetch'
import { createSearchTool } from '@/lib/tools/search'

import { type SearchFixture } from '../lib/dataset'

// Mirrors the production fetch tool's contract while serving the item's own
// fixture, so the model can follow a URL out of the search results without the
// answer depending on what that page says today.
export function createFixtureFetchTool(results: SearchFixture[]) {
  return tool({
    description: fetchTool.description,
    inputSchema: fetchTool.inputSchema,
    async execute({ url }: { url: string }) {
      const match = results.find(result => result.url === url)
      return {
        state: 'complete' as const,
        query: url,
        results: match ? [match] : results,
        images: [],
        number_of_results: match ? 1 : results.length
      }
    }
  })
}

export function createFixtureSearchTool({
  results,
  toModelOutput,
  onQuery
}: {
  results: SearchFixture[]
  toModelOutput: ReturnType<typeof createSearchTool>['toModelOutput']
  onQuery: (query: string) => void
}) {
  return tool({
    description: 'Search the web for information.',
    inputSchema: z.object({
      query: z.string(),
      type: z.enum(['optimized', 'general']).optional(),
      max_results: z.number().optional()
    }),
    async execute({ query }) {
      onQuery(query)
      return {
        state: 'complete' as const,
        query,
        results,
        images: [],
        number_of_results: results.length,
        toolCallId: 'fixture-search'
      }
    },
    toModelOutput: toModelOutput as never
  })
}
