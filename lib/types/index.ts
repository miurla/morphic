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
