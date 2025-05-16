import { SearchResultItem, SearchResults, SearXNGResponse, SearXNGResult } from '@/lib/types'
import { BaseSearchProvider } from './base'

export class SearXNGSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiUrl = process.env.SEARXNG_API_URL
    this.validateApiUrl(apiUrl, 'SEARXNG')

    try {
      // Construct the URL with query parameters
      const url = new URL(`${apiUrl}/search`)
      url.searchParams.append('q', query)
      url.searchParams.append('format', 'json')
      url.searchParams.append('categories', 'general,images')

      // Apply search depth settings
      if (searchDepth === 'advanced') {
        url.searchParams.append('time_range', '')
        url.searchParams.append('safesearch', '0')
        url.searchParams.append('engines', 'google,bing,duckduckgo,wikipedia')
      } else {
        url.searchParams.append('time_range', 'year')
        url.searchParams.append('safesearch', '1')
        url.searchParams.append('engines', 'google,bing')
      }

      // Apply domain filters if provided
      if (includeDomains.length > 0) {
        url.searchParams.append('site', includeDomains.join(','))
      }

      // Fetch results from SearXNG
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`SearXNG API error (${response.status}):`, errorText)
        throw new Error(
          `SearXNG API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data: SearXNGResponse = await response.json()

      // Separate general results and image results, and limit to maxResults
      const generalResults = data.results
        .filter(result => !result.img_src)
        .slice(0, maxResults)
      const imageResults = data.results
        .filter(result => result.img_src)
        .slice(0, maxResults)

      // Format the results to match the expected SearchResults structure
      return {
        results: generalResults.map(
          (result: SearXNGResult): SearchResultItem => ({
            title: result.title,
            url: result.url,
            content: result.content
          })
        ),
        query: data.query,
        images: imageResults
          .map(result => {
            const imgSrc = result.img_src || ''
            return imgSrc.startsWith('http') ? imgSrc : `${apiUrl}${imgSrc}`
          })
          .filter(Boolean),
        number_of_results: data.number_of_results
      }
    } catch (error) {
      console.error('SearXNG API error:', error)
      throw error
    }
  }
}