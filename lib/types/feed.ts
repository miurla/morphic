export type FeedAction = 'discover' | 'read'

export type FeedFormat = 'rss2' | 'rss1' | 'atom' | 'json' | 'unknown'

export interface FeedDiscoveryResult {
  title?: string
  description?: string
  url: string
  siteName?: string
  siteUrl?: string
  selfUrl?: string
  favicon?: string
  contentType?: string
  version?: string
  format: FeedFormat
  itemCount?: number
  lastSeen?: string
  lastUpdated?: string
  velocity?: number
  score?: number
  isPodcast?: boolean
  isPush?: boolean
  hubs?: string[]
  source: 'feedsearch.dev' | 'html-autodiscovery' | 'direct'
}

export interface PodcastFunding {
  url?: string
  message?: string
}

export interface PodcastPerson {
  name: string
  role?: string
  group?: string
  href?: string
  img?: string
}

export interface PodcastValueRecipient {
  name?: string
  type?: string
  address?: string
  split?: number
  customKey?: string
  customValue?: string
}

export interface PodcastValue {
  type?: string
  method?: string
  suggested?: string
  recipients: PodcastValueRecipient[]
}

export interface PodcastTranscript {
  url: string
  type?: string
  language?: string
  rel?: string
}

export interface PodcastChapters {
  url: string
  type?: string
}

export interface PodcastSoundbite {
  startTime?: number
  duration?: number
  title?: string
}

export interface PodcastMetadata {
  guid?: string
  medium?: string
  locked?: {
    value: boolean
    owner?: string
  }
  funding?: PodcastFunding[]
  value?: PodcastValue
  people?: PodcastPerson[]
  location?: string
  transcripts?: PodcastTranscript[]
  chapters?: PodcastChapters
  soundbites?: PodcastSoundbite[]
  season?: string
  episode?: string
  episodeType?: string
  explicit?: boolean
  image?: string
  categories?: string[]
}

export interface FeedItem {
  id?: string
  title: string
  url?: string
  content?: string
  summary?: string
  author?: string
  published?: string
  updated?: string
  enclosures?: {
    url: string
    type?: string
    length?: string
  }[]
  podcast?: PodcastMetadata
}

export interface ParsedFeed {
  title?: string
  description?: string
  url: string
  siteUrl?: string
  format: FeedFormat
  version?: string
  language?: string
  image?: string
  isPodcast: boolean
  podcast?: PodcastMetadata
  items: FeedItem[]
}

export interface FeedSearchResults {
  action: FeedAction
  url: string
  state?: 'searching' | 'complete'
  attribution?: {
    label: string
    url: string
  }
  feeds?: FeedDiscoveryResult[]
  feed?: ParsedFeed
  toolCallId?: string
}
