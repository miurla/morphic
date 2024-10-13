import { tool } from 'ai'
import { retrieveSchema } from '@/lib/schema/retrieve'
import { ToolProps } from '.'
import { DefaultSkeleton } from '@/components/default-skeleton'
import { SearchResults as SearchResultsType } from '@/lib/types'
import RetrieveSection from '@/components/retrieve-section'

const CONTENT_CHARACTER_LIMIT = 10000

async function fetchJinaReaderData(
  url: string
): Promise<SearchResultsType | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-With-Generated-Alt': 'true'
      }
    })
    const json = await response.json()
    if (!json.data || json.data.length === 0) {
      return null
    }

    const content = json.data.content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: json.data.title,
          content,
          url: json.data.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('Jina Reader API error:', error)
    return null
  }
}

async function fetchTavilyExtractData(
  url: string
): Promise<SearchResultsType | null> {
  try {
    const apiKey = process.env.TAVILY_API_KEY
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api_key: apiKey, urls: [url] })
    })
    const json = await response.json()
    if (!json.results || json.results.length === 0) {
      return null
    }

    const result = json.results[0]
    const content = result.raw_content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: content.slice(0, 100),
          content,
          url: result.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('Tavily Extract API error:', error)
    return null
  }
}

export const retrieveTool = ({ uiStream, fullResponse }: ToolProps) =>
  tool({
    description: 'Retrieve content from the web',
    parameters: retrieveSchema,
    execute: async ({ url }) => {
      // Append the search section
      uiStream.update(<DefaultSkeleton />)

      let results: SearchResultsType | null

      // Use Jina if the API key is set, otherwise use Tavily
      const useJina = process.env.JINA_API_KEY
      if (useJina) {
        results = await fetchJinaReaderData(url)
      } else {
        results = await fetchTavilyExtractData(url)
      }

      if (!results) {
        fullResponse = `An error occurred while retrieving "${url}".`
        uiStream.update(null)
        return results
      }

      uiStream.update(<RetrieveSection data={results} />)

      return results
    }
  })
