import { SearXNGEngineSearchProvider } from './searxng-engine'

export class DuckDuckGoSearchProvider extends SearXNGEngineSearchProvider {
  constructor() {
    super({ engine: 'duckduckgo', label: 'DuckDuckGo' })
  }
}
