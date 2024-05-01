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

export interface IShopifyProduct {
  id: string
  title: string
  description: string
  tags: string[]
  vendor: string
  productType: string
  priceRange: {
    minVariantPrice: {
      amount: string
    }
    maxVariantPrice: {
      amount: string
    }
  }
}
