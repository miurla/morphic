import { createStreamableValue } from 'ai/rsc'
import Exa from 'exa-js'
import { searchSchema } from '@/lib/schema/search'
import { Card } from '@/components/ui/card'
import { SearchSection } from '@/components/search-section'
import { ToolProps } from '.'

export const searchTool = ({ uiStream, fullResponse }: ToolProps) => ({
  description: 'Search the web for information',
  parameters: searchSchema,
  execute: async ({
    query,
    max_results,
    search_depth
  }: {
    query: string
    max_results: number
    search_depth: 'basic' | 'advanced'
  }) => {
    let hasError = false
    // Append the search section
    const streamResults = createStreamableValue<string>()
    uiStream.append(<SearchSection result={streamResults.value} />)

    // Tavily API requires a minimum of 5 characters in the query
    const filledQuery =
      query.length < 5 ? query + ' '.repeat(5 - query.length) : query
    let searchResult
    const searchAPI: 'tavily' | 'exa' = 'tavily'
    try {
      searchResult =
        searchAPI === 'tavily'
          ? await tavilySearch(filledQuery, max_results, search_depth)
          : await exaSearch(query)
    } catch (error) {
      console.error('Search API error:', error)
      hasError = true
    }

    if (hasError) {
      fullResponse += `\nAn error occurred while searching for "${query}.`
      uiStream.update(
        <Card className="p-4 mt-2 text-sm">
          {`An error occurred while searching for "${query}".`}
        </Card>
      )
      return searchResult
    }

    streamResults.done(JSON.stringify(searchResult))

    return searchResult
  }
})

async function tavilySearch(
  query: string,
  maxResults: number = 10,
  searchDepth: 'basic' | 'advanced' = 'basic'
): Promise<any> {
  const apiKey = process.env.TAVILY_API_KEY
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults < 5 ? 5 : maxResults,
      search_depth: searchDepth,
      include_images: true,
      include_answers: true
    })
  })

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`)
  }

  const data = await response.json()
  return data
}

async function exaSearch(query: string, maxResults: number = 10): Promise<any> {
  const apiKey = process.env.EXA_API_KEY
  const exa = new Exa(apiKey)
  return exa.searchAndContents(query, {
    highlights: true,
    numResults: maxResults
  })
}
