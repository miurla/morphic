import { SearchResults } from '@/lib/types'
import { sanitizeUrl } from '@/lib/utils'
import { BaseSearchProvider } from './base'

export class YouSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = [],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
    }
  ): Promise<SearchResults> {
    const apiKey = process.env.YDC_API_KEY
    this.validateApiKey(apiKey, 'YOU')

    const response = await fetch('https://api.you.com/v1/agents/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        // Mapping searchDepth to something You.com understands if applicable, 
        // otherwise keeping it simple for now.
      }),
    })

    if (!response.ok) {
      console.error(`You.com API error: ${response.status} ${response.statusText}`)
      throw new Error('Search failed')
    }

    const data = await response.json()

    // Map You.com response to Morphic's SearchResults
    // Based on SearchResults type:
    // images: SearchResultImage[]
    // results: SearchResultItem[] (title, url, content)
    
    const results = (data.results ?? []).map((item: any) => ({
      title: item.title || 'Untitled',
      url: sanitizeUrl(item.url),
      content: item.snippet || item.content || '',
    }))

    const images = (data.images ?? []).map((img: any) => {
      if (typeof img === 'string') return sanitizeUrl(img)
      return {
        url: sanitizeUrl(img.url),
        description: img.description || '',
        title: img.title,
        sourceUrl: img.sourceUrl,
      }
    })

    return {
      query,
      results,
      images,
      number_of_results: results.length,
    }
  }
}
