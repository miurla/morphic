import { FirecrawlClient } from '@/lib/firecrawl'
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
      // TODO: check deep if we need to add these
      // includeDomains: includeDomains.length > 0 ? includeDomains : undefined,
      // excludeDomains: excludeDomains.length > 0 ? excludeDomains : undefined
    })

    const results = [
      ...(response.data?.web || []),
      ...(response.data?.news || [])
    ].map((r: any) => ({
      title: r.title || '',
      url: r.url,
      content: r.markdown?.slice(0, 1000) || r.snippet || r.description || ''
    }))

    const images =
      response.data?.images?.map((img: any) => ({
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
