import { SearchProvider } from './base'
import { BraveSearchProvider } from './brave'
import { DuckDuckGoSearchProvider } from './duckduckgo'
import { ExaSearchProvider } from './exa'
import { FirecrawlSearchProvider } from './firecrawl'
import { KagiSearchProvider } from './kagi'
import { QwantSearchProvider } from './qwant'
import { SearXNGSearchProvider } from './searxng'
import { TavilySearchProvider } from './tavily'

export type SearchProviderType =
  | 'tavily'
  | 'exa'
  | 'searxng'
  | 'firecrawl'
  | 'brave'
  | 'qwant'
  | 'duckduckgo'
  | 'kagi'
export const DEFAULT_PROVIDER: SearchProviderType = 'qwant'

export function createSearchProvider(
  type?: SearchProviderType
): SearchProvider {
  const providerType =
    type || (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER

  switch (providerType) {
    case 'tavily':
      return new TavilySearchProvider()
    case 'exa':
      return new ExaSearchProvider()
    case 'searxng':
      return new SearXNGSearchProvider()
    case 'brave':
      return new BraveSearchProvider()
    case 'qwant':
      return new QwantSearchProvider()
    case 'duckduckgo':
      return new DuckDuckGoSearchProvider()
    case 'firecrawl':
      return new FirecrawlSearchProvider()
    case 'kagi':
      return new KagiSearchProvider()
    default:
      return new QwantSearchProvider()
  }
}

export { BraveSearchProvider } from './brave'
export { DuckDuckGoSearchProvider } from './duckduckgo'
export type { ExaSearchProvider } from './exa'
export type { FirecrawlSearchProvider } from './firecrawl'
export { KagiSearchProvider } from './kagi'
export { QwantSearchProvider } from './qwant'
export { SearXNGSearchProvider } from './searxng'
export { TavilySearchProvider } from './tavily'
export type { SearchProvider }
