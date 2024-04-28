import { Message } from 'ai'

export type SearchResults = {
  images: string[]
  results: SearchResultItem[]
  query: string
}

export type SearchResultItem = {
  title: string
  url: string
  content: string
}

export interface Chat extends Record<string, any> {
  id: string
  title: string
  createdAt: Date
  userId: string
  path: string
  messages: Message[]
  sharePath?: string
}
