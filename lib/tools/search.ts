import { getSearchSchemaForModel } from '@/lib/schema/search'
import { SearchResults } from '@/lib/types'
import { getBaseUrlString } from '@/lib/utils/url'
import { tool } from 'ai'
import { DEFAULT_PROVIDER, SearchProviderType, createSearchProvider } from './search/providers'

/**
 * Creates a search tool with the appropriate schema for the given model.
 */
export function createSearchTool(fullModel: string) {
  return tool({
    description: 'Search the web for information',
    parameters: getSearchSchemaForModel(fullModel),
    execute: async ({
      query,
      max_results = 20,
      search_depth = 'basic', // Default for standard schema
      include_domains = [],
      exclude_domains = []
    }) => {
      // Ensure max_results is at least 10
      const minResults = 10
      const effectiveMaxResults = Math.max(
        max_results || minResults,
        minResults
      )
      const effectiveSearchDepth = search_depth as 'basic' | 'advanced'

      // Use the original query as is - any provider-specific handling will be done in the provider
      const filledQuery = query
      let searchResult: SearchResults
      const searchAPI =
        (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER

      const effectiveSearchDepthForAPI =
        searchAPI === 'searxng' &&
        process.env.SEARXNG_DEFAULT_DEPTH === 'advanced'
          ? 'advanced'
          : effectiveSearchDepth || 'basic'

      console.log(
        `Using search API: ${searchAPI}, Search Depth: ${effectiveSearchDepthForAPI}`
      )

      try {
        if (
          searchAPI === 'searxng' &&
          effectiveSearchDepthForAPI === 'advanced'
        ) {
          // Get the base URL using the centralized utility function
          const baseUrl = await getBaseUrlString()
          
          const response = await fetch(`${baseUrl}/api/advanced-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: filledQuery,
              maxResults: effectiveMaxResults,
              searchDepth: effectiveSearchDepthForAPI,
              includeDomains: include_domains,
              excludeDomains: exclude_domains
            })
          })
          if (!response.ok) {
            throw new Error(
              `Advanced search API error: ${response.status} ${response.statusText}`
            )
          }
          searchResult = await response.json()
        } else {
          // Use the provider factory to get the appropriate search provider
          const searchProvider = createSearchProvider(searchAPI)
          searchResult = await searchProvider.search(
            filledQuery,
            effectiveMaxResults,
            effectiveSearchDepthForAPI,
            include_domains,
            exclude_domains
          )
        }
      } catch (error) {
        console.error('Search API error:', error)
        searchResult = {
          results: [],
          query: filledQuery,
          images: [],
          number_of_results: 0
        }
      }

      console.log('completed search')
      return searchResult
    }
  })
}

// Default export for backward compatibility, using a default model
export const searchTool = createSearchTool('openai:gpt-4o-mini')

export async function search(
  query: string,
  maxResults: number = 10,
  searchDepth: 'basic' | 'advanced' = 'basic',
  includeDomains: string[] = [],
  excludeDomains: string[] = []
): Promise<SearchResults> {
  return searchTool.execute(
    {
      query,
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
}
