import { SearXNGEngineSearchProvider } from './searxng-engine'

export class QwantSearchProvider extends SearXNGEngineSearchProvider {
  constructor() {
    super({
      engine: 'qwant',
      label: 'Qwant',
      fallbackEngine: {
        engine: 'duckduckgo',
        label: 'DuckDuckGo'
      }
    })
  }
}
