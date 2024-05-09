import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import {
  CoreMessage,
  ToolCallPart,
  ToolResultPart,
  streamText as nonexperimental_streamText
} from 'ai'
import { searchSchema } from '@/lib/schema/search'
import { Section } from '@/components/section'
import { OpenAI } from '@ai-sdk/openai'
import { BotMessage } from '@/components/message'
import Exa from 'exa-js'
import { Card } from '@/components/ui/card'
import { SearchSection } from '@/components/search-section'

export async function researcher(
  uiStream: ReturnType<typeof createStreamableUI>,
  streamText: ReturnType<typeof createStreamableValue<string>>,
  messages: CoreMessage[],
  useSpecificModel?: boolean
) {
  const openai = new OpenAI({
    baseUrl: process.env.OPENAI_API_BASE, // optional base URL for proxies etc.
    apiKey: process.env.OPENAI_API_KEY, // optional API key, default to env property OPENAI_API_KEY
    organization: '' // optional organization
  })

  const searchAPI: 'tavily' | 'exa' = 'tavily'

  let fullResponse = ''
  let hasError = false
  const answerSection = (
    <Section title="Answer">
      <BotMessage content={streamText.value} />
    </Section>
  )

  let isFirstToolResponse = true
  const result = await nonexperimental_streamText({
    model: openai.chat(process.env.OPENAI_API_MODEL || 'gpt-4-turbo'),
    maxTokens: 2500,
    system: `As a professional search expert, you possess the ability to search for any information on the web. 
    For each user query, utilize the search results to their fullest potential to provide additional information and assistance in your response.
    If there are any images relevant to your answer, be sure to include them as well.
    Aim to directly address the user's question, augmenting your response with insights gleaned from the search results.
    Whenever quoting or referencing information from a specific URL, always cite the source URL explicitly.
    Please match the language of the response to the user's language.`,
    messages,
    tools: {
      search: {
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
          // If this is the first tool response, remove spinner
          if (isFirstToolResponse) {
            isFirstToolResponse = false
            uiStream.update(null)
          }
          // Append the search section
          const streamResults = createStreamableValue<string>()
          uiStream.append(<SearchSection result={streamResults.value} />)

          // Tavily API requires a minimum of 5 characters in the query
          const filledQuery =
            query.length < 5 ? query + ' '.repeat(5 - query.length) : query
          let searchResult
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
      }
    }
  })

  const toolCalls: ToolCallPart[] = []
  const toolResponses: ToolResultPart[] = []
  for await (const delta of result.fullStream) {
    switch (delta.type) {
      case 'text-delta':
        if (delta.textDelta) {
          // If the first text delata is available, add a ui section
          if (fullResponse.length === 0 && delta.textDelta.length > 0) {
            // Update the UI
            uiStream.update(answerSection)
          }

          fullResponse += delta.textDelta
          streamText.update(fullResponse)
        }
        break
      case 'tool-call':
        toolCalls.push(delta)
        break
      case 'tool-result':
        // Append the answer section if the specific model is not used
        if (!useSpecificModel && toolResponses.length === 0) {
          uiStream.append(answerSection)
        }
        toolResponses.push(delta)
        break
      case 'error':
        hasError = true
        fullResponse += `\nError occurred while executing the tool`
        break
    }
  }
  messages.push({
    role: 'assistant',
    content: [{ type: 'text', text: fullResponse }, ...toolCalls]
  })

  if (toolResponses.length > 0) {
    // Add tool responses to the messages
    messages.push({ role: 'tool', content: toolResponses })
  }

  return { result, fullResponse, hasError, toolResponses }
}

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
