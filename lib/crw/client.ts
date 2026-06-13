import {
  CrwImageSearchOptions,
  CrwImageSearchResponse,
  CrwSearchOptions,
  CrwSearchResponse
} from './types'

// fastCRW is a Firecrawl-compatible web data engine (single binary; self-host
// or cloud). It exposes the same request/response shapes as Firecrawl, so the
// client mirrors the Firecrawl client and only swaps the base URL. The cloud
// base URL is https://fastcrw.com/api; CRW_API_URL overrides it for self-host.
const DEFAULT_BASE_URL = 'https://fastcrw.com/api'

export class CrwClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = (
      baseUrl ||
      process.env.CRW_API_URL ||
      DEFAULT_BASE_URL
    ).replace(/\/$/, '')
  }

  async search(options: CrwSearchOptions): Promise<CrwSearchResponse> {
    const body = JSON.stringify({
      query: options.query,
      sources: options.sources || ['web'],
      limit: options.limit || 10,
      location: options.location,
      tbs: options.tbs,
      scrapeOptions: {
        formats: ['markdown'],
        proxy: 'auto',
        blockAds: true
      }
    })
    const response = await fetch(`${this.baseUrl}/v1/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body
    })

    return this.handleResponse<CrwSearchResponse>(response)
  }

  async searchImages(
    options: CrwImageSearchOptions
  ): Promise<CrwImageSearchResponse> {
    const body = JSON.stringify({
      query: options.query,
      sources: ['images'],
      limit: options.limit || 8
    })

    const response = await fetch(`${this.baseUrl}/v1/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body
    })

    return this.handleResponse<CrwImageSearchResponse>(response)
  }

  async getImagesForQuery(
    query: string,
    maxResults: number = 8
  ): Promise<{ url: string; description: string }[]> {
    try {
      const searchResponse = await this.searchImages({
        query,
        limit: maxResults
      })

      const data = searchResponse.data

      if (!searchResponse.success || !data.images) return []

      return data.images.map(image => ({
        url: image.imageUrl,
        description: image.title ?? ''
      }))
    } catch (error) {
      console.error('CRW image search error:', error)
      return []
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `CRW status: ${response.status}, reason error: ${errorText}`
      )
    }
    return response.json()
  }
}
