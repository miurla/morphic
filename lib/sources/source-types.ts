import type { KnowledgeGraphEntity } from '@/lib/entities/knowledge-graph'

export type SourceKind =
  | 'web'
  | 'news'
  | 'feed-item'
  | 'feed'
  | 'forum'
  | 'official-doc'
  | 'academic'
  | 'pdf'
  | 'uploaded-file'
  | 'podcast'
  | 'video'
  | 'image'
  | 'map-place'
  | 'unknown'

export type SourceRetrievalMethod =
  | 'search'
  | 'feed'
  | 'fetch'
  | 'upload'
  | 'library'
  | 'map'

export interface NormalizedSource {
  id: string
  kind: SourceKind
  title: string
  url?: string
  canonicalUrl?: string
  domain?: string
  siteName?: string
  author?: string
  publishedAt?: string
  updatedAt?: string
  summary?: string
  snippet?: string
  imageUrl?: string
  faviconUrl?: string
  language?: string
  provider?: string
  retrievalMethod: SourceRetrievalMethod
  retrievalQuery?: string
  rank?: number
  score?: number
  sourcePreference?: {
    preference: 'trust' | 'prefer' | 'mute' | 'block'
    matchedBy: 'domain' | 'url'
    matchedValue: string
  }
  entities?: KnowledgeGraphEntity[]
  raw?: unknown
}
