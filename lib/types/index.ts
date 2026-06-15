// Re-export SearchMode for convenience
import type { KnowledgeGraphEntity } from '@/lib/entities/knowledge-graph'

export type { SearchMode } from './search'

export type SearchResults = {
  images: SearchResultImage[]
  results: SearchResultItem[]
  videos?: SerperSearchResultItem[]
  number_of_results?: number
  query: string
  toolCallId?: string // ID of the search tool call
  citationMap?: Record<number, SearchResultItem> // Maps citation number to search result
  entities?: KnowledgeGraphEntity[]
}

// If include_images_description is true, images are objects with url/description.
// When the provider can resolve the referring page, sourceUrl and title are also set.
// Otherwise, the images are an array of strings.
export type SearchResultImage =
  | string
  | {
      url: string
      description: string
      title?: string
      sourceUrl?: string
      number_of_results?: number
    }

export type ExaSearchResults = {
  results: ExaSearchResultItem[]
}

export type SerperSearchResults = {
  searchParameters: {
    q: string
    type: string
    engine: string
  }
  videos: SerperSearchResultItem[]
}

export type SearchResultItem = {
  title: string
  url: string
  content: string
  sourceKind?: 'web' | 'news' | 'feed-item' | 'podcast' | 'video' | 'image'
  provider?: string
  retrievalMethod?: 'search' | 'feed'
  publishedAt?: string
  updatedAt?: string
  siteName?: string
  sourcePreference?: {
    preference: 'trust' | 'prefer' | 'mute' | 'block'
    matchedBy: 'domain' | 'url'
    matchedValue: string
  }
  entities?: KnowledgeGraphEntity[]
}

export type ExaSearchResultItem = {
  score: number
  title: string
  id: string
  url: string
  publishedDate: Date
  author: string
}

export type SerperSearchResultItem = {
  title: string
  link: string
  snippet: string
  imageUrl: string
  duration: string
  source: string
  channel: string
  date: string
  position: number
}

export type SearchImageItem = {
  title: string
  link: string
  thumbnailUrl: string
}

export interface SearXNGResult {
  title: string
  url: string
  content: string
  img_src?: string
  publishedDate?: string
  score?: number
}

export interface SearXNGResponse {
  query: string
  number_of_results: number
  results: SearXNGResult[]
  unresponsive_engines?: [string, string][]
}

export type SearXNGImageResult = string

export type SearXNGSearchResults = {
  images: SearXNGImageResult[]
  results: SearchResultItem[]
  number_of_results?: number
  query: string
}

export type UploadedFile = {
  file: File
  status: 'uploading' | 'uploaded' | 'error'
  url?: string
  name?: string
  key?: string
}
