import {
  FirecrawlClient,
  FirecrawlImageResult,
  FirecrawlNewsResult,
  FirecrawlWebResult
} from '@/lib/firecrawl'
import { BaseSearchProvider } from '@/lib/tools/search/providers/base'
import { SearchResults } from '@/lib/types'

export class FirecrawlSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey = process.env.FIRECRAWL_API_KEY
    this.validateApiKey(apiKey, 'FIRECRAWL')

    const firecrawl = new FirecrawlClient(apiKey)

    const sources: ('web' | 'news' | 'images')[] = ['web']
    if (searchDepth === 'advanced') {
      sources.push('news')
    }
    sources.push('images')

    const response = await firecrawl.search({
      query,
      sources,
      limit: maxResults
      // Note: Firecrawl Search API does not support includeDomains/excludeDomains yet...
    })

    const resources: (FirecrawlWebResult | FirecrawlNewsResult)[] = [
      ...(response.data?.web || []),
      ...(response.data?.news || [])
    ]

    const results = resources.map(resource => {
      if ('markdown' in resource) {
        const markdown = resource.markdown.slice(0, 1000)
        return {
          title: resource.title || '',
          url: resource.url,
          content: markdown || resource.description || ''
        }
      }

      return {
        title: resource.title || '',
        url: resource.url,
        content: resource.snippet || ''
      }
    })

    const images =
      response.data?.images?.map((img: FirecrawlImageResult) => ({
        url: img.imageUrl,
        description: img.title || ''
      })) || []

    return {
      results,
      query,
      images,
      number_of_results: results.length
    }
  }
}
