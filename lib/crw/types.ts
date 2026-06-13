export type CrwSource = 'web' | 'news' | 'images'

export type CrwSearchOptions = {
  query: string
  sources?: CrwSource[]
  limit?: number
  location?: string
  tbs?: string
}

export type CrwImageSearchOptions = {
  query: string
  sources?: ['images']
  limit?: number
}

export type CrwImageResult = {
  title: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  url: string
  position: number
}

export type CrwWebResult = {
  url: string
  title: string
  description: string
  markdown: string
  position: number
}

export type CrwNewsResult = {
  title: string
  url: string
  snippet: string
  date: string
  position: number
}

type CrwSearchResponseData = {
  web?: CrwWebResult[]
  news?: CrwNewsResult[]
  images?: CrwImageResult[]
}
export type CrwSearchResponse = {
  success: boolean
  data: CrwSearchResponseData
}

type CrwImageSearchResponseData = {
  images?: CrwImageResult[]
}

export type CrwImageSearchResponse = {
  success: boolean
  data: CrwImageSearchResponseData
}
