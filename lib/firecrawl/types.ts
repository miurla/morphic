export type FirecrawlSource = 'web' | 'news' | 'images'

export type FirecrawlSearchOptions = {
  query: string
  sources?: FirecrawlSource[]
  limit?: number
  location?: string
  tbs?: string
}

export type FirecrawlImageSearchOptions = {
  query: string
  sources?: ['images']
  limit?: number
}

export type FirecrawlImageResult = {
  title: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  url: string
  position: number
}

export type FirecrawlWebResult = {
  url: string
  title: string
  description: string
  markdown: string
  position: number
}

export type FirecrawlNewsResult = {
  title: string
  url: string
  snippet: string
  date: string
  position: number
}

type FirecrawlSearchResponseData = {
  web?: FirecrawlWebResult[]
  news?: FirecrawlNewsResult[]
  images?: FirecrawlImageResult[]
}
export type FirecrawlSearchResponse = {
  success: boolean
  data: FirecrawlSearchResponseData
}

type FirecrawlImageSearchResponseData = {
  images?: FirecrawlImageResult[]
}

export type FirecrawlImageSearchResponse = {
  success: boolean
  data: FirecrawlImageSearchResponseData
}
