import { UIToolInvocation } from 'ai'

import type { UserProfile } from '@/lib/supabase/types'
import { SearchResults } from '@/lib/types'

import { createAgriSearchTool } from './agri-search'

/**
 * Creates the AgriEvidence search tool using Parallel Search while preserving
 * Morphic's existing tool name, schema, streaming states, and result shape.
 */
export function createSearchTool(
  fullModel: string,
  userProfile?: UserProfile | null
) {
  return createAgriSearchTool(fullModel, userProfile)
}

// Default export for backward compatibility, using the AgriEvidence default model.
export const searchTool = createSearchTool('deepseek:deepseek-v4-pro')

// Export type for UI tool invocation.
export type SearchUIToolInvocation = UIToolInvocation<typeof searchTool>

export async function search(
  query: string,
  maxResults: number = 8,
  searchDepth: 'basic' | 'advanced' = 'basic',
  includeDomains: string[] = [],
  excludeDomains: string[] = []
): Promise<SearchResults> {
  const result = await searchTool.execute?.(
    {
      query,
      type: 'general',
      content_types: ['web'],
      max_results: maxResults,
      search_depth: searchDepth,
      include_domains: includeDomains,
      exclude_domains: excludeDomains
    },
    {
      toolCallId: 'search',
      messages: []
    }
  )

  if (!result) {
    return { results: [], images: [], query, number_of_results: 0 }
  }

  if (Symbol.asyncIterator in result) {
    let searchResults: SearchResults | null = null
    for await (const chunk of result) {
      if ('state' in chunk && chunk.state === 'complete') {
        const { state, ...rest } = chunk
        searchResults = rest as SearchResults
      }
    }
    return (
      searchResults ?? { results: [], images: [], query, number_of_results: 0 }
    )
  }

  return result as SearchResults
}
