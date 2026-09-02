import { type JSONValue, tool, UIToolInvocation } from 'ai'

import { ToolFailureError } from '@/lib/errors/tool-error'
import { getSearchSchemaForModel } from '@/lib/schema/search'
import { SearchResults } from '@/lib/types'
import { deriveCitationId } from '@/lib/utils/citation'
import {
  getGeneralSearchProviderType,
  getSearchToolDescription
} from '@/lib/utils/search-config'
import { getBaseUrlString } from '@/lib/utils/url'
import { logToolPayload } from '@/lib/utils/usage-logging'

import {
  createSearchProvider,
  DEFAULT_PROVIDER,
  SearchProviderType
} from './search/providers'
import {
  classifyRecoverableSearchError,
  RecoverableSearchFailure
} from './search/providers/recoverable-error'

function getOptimizedSearchProviderType(): SearchProviderType {
  return (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER
}

function getEffectiveSearchDepth(
  provider: SearchProviderType,
  requestedDepth: 'basic' | 'advanced'
): 'basic' | 'advanced' {
  return provider === 'searxng' &&
    process.env.SEARXNG_DEFAULT_DEPTH === 'advanced'
    ? 'advanced'
    : requestedDepth || 'basic'
}

function describeRecoverableSearchFailure(
  failure: RecoverableSearchFailure
): string {
  return failure.type === 'http' ? `HTTP ${failure.status}` : 'transport error'
}

/**
 * Creates a search tool with the appropriate schema for the given model.
 */
export function createSearchTool(fullModel: string) {
  return tool({
    description: getSearchToolDescription(),
    inputSchema: getSearchSchemaForModel(fullModel),
    async *execute(
      {
        query,
        type = 'optimized',
        content_types = ['web'],
        max_results = 20,
        search_depth = 'basic', // Default for standard schema
        include_domains = [],
        exclude_domains = []
      },
      context
    ) {
      // Yield initial searching state
      yield {
        state: 'searching' as const,
        query
      }
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
      let servedBySearchAPI: SearchProviderType
      let fallback:
        | {
            from: SearchProviderType
            to: SearchProviderType
            reason: RecoverableSearchFailure
          }
        | undefined

      const optimizedSearchAPI = getOptimizedSearchProviderType()

      // Determine which provider to use based on type
      let generalSearchAPI: SearchProviderType | null = null
      let searchAPI: SearchProviderType
      if (type === 'general') {
        // Try to use dedicated general search provider
        const generalProvider = getGeneralSearchProviderType()
        if (generalProvider) {
          generalSearchAPI = generalProvider
          searchAPI = generalProvider
        } else {
          // Fallback to primary provider (optimized search provider)
          searchAPI = optimizedSearchAPI
          console.log(
            `[Search] type="general" requested but no dedicated provider available, using optimized search provider: ${searchAPI}`
          )
        }
      } else {
        // For 'optimized', use the configured provider
        searchAPI = optimizedSearchAPI
      }

      const searchWithProvider = async (
        provider: SearchProviderType
      ): Promise<SearchResults> => {
        const effectiveSearchDepthForAPI = getEffectiveSearchDepth(
          provider,
          effectiveSearchDepth
        )

        console.log(
          `Using search API: ${provider}, Type: ${type}, Search Depth: ${effectiveSearchDepthForAPI}`
        )

        if (
          provider === 'searxng' &&
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
          return response.json()
        }

        // Use the provider factory to get the appropriate search provider
        const searchProvider = createSearchProvider(provider)

        // Pass content_types only for Brave provider
        if (provider === 'brave') {
          return searchProvider.search(
            filledQuery,
            effectiveMaxResults,
            effectiveSearchDepthForAPI,
            include_domains,
            exclude_domains,
            {
              type: type as 'general' | 'optimized',
              content_types: content_types as Array<
                'web' | 'video' | 'image' | 'news'
              >
            }
          )
        }

        return searchProvider.search(
          filledQuery,
          effectiveMaxResults,
          effectiveSearchDepthForAPI,
          include_domains,
          exclude_domains
        )
      }

      try {
        searchResult = await searchWithProvider(searchAPI)
        servedBySearchAPI = searchAPI
      } catch (error) {
        const recoverableFailure = classifyRecoverableSearchError(error)
        if (
          generalSearchAPI !== null &&
          generalSearchAPI !== optimizedSearchAPI &&
          recoverableFailure !== null
        ) {
          console.warn(
            `[Search] dedicated general search provider ${generalSearchAPI} failed with ${describeRecoverableSearchFailure(recoverableFailure)}; using optimized search provider: ${optimizedSearchAPI}`
          )

          try {
            searchResult = await searchWithProvider(optimizedSearchAPI)
            servedBySearchAPI = optimizedSearchAPI
            fallback = {
              from: generalSearchAPI,
              to: optimizedSearchAPI,
              reason: recoverableFailure
            }
          } catch (fallbackError) {
            console.error('Search fallback API error:', fallbackError)
            throw new ToolFailureError('search', fallbackError)
          }
        } else {
          console.error('Search API error:', error)
          // Re-throw the error to let AI SDK handle it properly
          throw new ToolFailureError('search', error)
        }
      }

      // No citationMap is attached: it fully duplicated `results`
      // (citationMap[N] === results[N-1]). The UI derives citations from
      // `results` by index instead (see extractCitationMaps), with a fallback
      // for older persisted messages that still carry citationMap.

      // Add citation identifiers from context
      if (context?.toolCallId) {
        searchResult.toolCallId = context.toolCallId
        searchResult.citeId = deriveCitationId(context.toolCallId)
      }

      console.log('completed search')

      logToolPayload('search', query, {
        results: searchResult.results,
        images: searchResult.images
      })

      // Yield final results with complete state
      yield {
        state: 'complete' as const,
        ...searchResult,
        provider: servedBySearchAPI,
        ...(fallback ? { fallback } : {})
      }
    },
    // Trim the model-facing tool result: citationMap fully duplicates
    // `results` (dropped defensively for older persisted output), state is a
    // streaming marker, and provider/fallback are trace diagnostics. images
    // MUST stay: getImageSpecPrompt instructs the model to embed URLs verbatim
    // from this array. citeId MUST stay: the prompt cites as [number](#citeId),
    // so the model reads the id from here. toolCallId is removed once citeId is
    // present, because two ids on one result invite the model to cite the wrong
    // one; it is kept for older output that has no citeId.
    toModelOutput: ({ output }) => {
      if (!output || typeof output !== 'object') {
        return { type: 'json', value: (output ?? null) as JSONValue }
      }
      const rest: Record<string, unknown> = {
        ...(output as Record<string, unknown>)
      }
      delete rest.citationMap
      delete rest.state
      delete rest.provider
      delete rest.fallback
      const citeId = rest.citeId
      if (citeId) {
        delete rest.citeId
        delete rest.toolCallId
      }
      // citeId leads the object so it is not buried behind the results the
      // model has to read before it can cite them.
      const modelView: Record<string, unknown> = citeId
        ? { citeId, ...rest }
        : rest
      return { type: 'json', value: modelView as JSONValue }
    }
  })
}

// Default export for backward compatibility, using a default model
export const searchTool = createSearchTool('openai:gpt-4o-mini')

// Export type for UI tool invocation
export type SearchUIToolInvocation = UIToolInvocation<typeof searchTool>

export async function search(
  query: string,
  maxResults: number = 10,
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
      messages: [],
      context: {}
    }
  )

  if (!result) {
    return { results: [], images: [], query, number_of_results: 0 }
  }

  // Handle AsyncIterable case
  if (Symbol.asyncIterator in result) {
    // Collect all results from the async iterable
    let searchResults: SearchResults | null = null
    for await (const chunk of result) {
      // Only assign when we get the complete result
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
