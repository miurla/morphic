import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import {
  ExperimentalMessage,
  ToolCallPart,
  ToolResultPart,
  experimental_streamText
} from 'ai'
import { searchSchema } from '@/lib/schema/search'
import { Section } from '@/components/section'
import { OpenAI } from '@ai-sdk/openai'
import { BotMessage } from '@/components/message'
import Exa from 'exa-js'
import { Card } from '@/components/ui/card'
import { SearchResults } from '../types'
import { SearchSection } from '@/components/search-section'
import { IShopifyProduct } from '../types/index'

interface IShopifySearchPayload {
  title_query: string
  tags_query: string
  vendor_query: string
}

// https://sdk.vercel.ai/docs/ai-core/stream-text
export async function researcher(
  uiStream: ReturnType<typeof createStreamableUI>,
  streamText: ReturnType<typeof createStreamableValue<string>>,
  messages: ExperimentalMessage[],
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
  console.log(messages)
  const result = await experimental_streamText({
    model: openai.chat(process.env.OPENAI_API_MODEL || 'gpt-4-turbo'),
    maxTokens: 2500,
    system: `You are a Shopify Search bot, you have the expertise to browse and curate product selections from Shopify stores using available tools.
    For each user query, leverage the product catalog to provide tailored recommendations and insights.
    Utilize the search results to assemble a list of relevant products that best address the user's needs.
    If there are any product images or descriptions pertinent to your response, ensure they are included for visual reference.
    Aim to directly address the user's search query by presenting a curated selection of Shopify products.
    Whenever referencing specific products or details from a Shopify store, include clear attributions and links to the respective product pages.
    Please ensure that the language of your response aligns with the user's preferred language for effective communication`,
    messages,
    tools: {
      shopifySearchTool: {
        description:
          'Search the Shopify store for product suggestions passing user query as input',
        parameters: searchSchema,
        execute: async (payload: IShopifySearchPayload) => {
          console.log('shopifySearchTool called')
          console.log(payload)
          // If this is the first tool response, remove spinner
          if (isFirstToolResponse) {
            isFirstToolResponse = false
            uiStream.update(null)
          }
          // Append the search section
          const streamResults = createStreamableValue<string>()
          uiStream.append(<SearchSection result={streamResults.value} />)

          let searchResult
          try {
            searchResult = await shopifyStoreSearch(payload)
          } catch (error) {
            console.error('Search API error:', error)
            hasError = true
          }

          if (hasError) {
            fullResponse += `\nAn error occurred while searching for "${payload.title.join(
              ','
            )}.`
            uiStream.update(
              <Card className="p-4 mt-2 text-sm">
                {`An error occurred while searching for "${payload.title.join(
                  ','
                )}".`}
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

async function shopifyStoreSearch(payload: IShopifySearchPayload): Promise<{
  results: Partial<IShopifyProduct>[]
}> {
  console.log(payload)
  const url = 'https://5919f3-2.myshopify.com/api/2024-04/graphql.json'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': `${process.env.STOREFRONT_TOKEN}`
  }
  let storefrontSearchQuery = ''
  const titleArr = payload.title_query.split(',')
  const tagsArr = payload.tags_query.split(',')
  if (titleArr.length) {
    storefrontSearchQuery += '('
    titleArr.forEach((title, index) => {
      storefrontSearchQuery += `title:${title.trim()}`
      if (index < titleArr.length - 1) {
        storefrontSearchQuery += ' OR '
      }
    })
    storefrontSearchQuery += ')'
  }
  /*if (tagsArr.length) {
    storefrontSearchQuery += '('
    tagsArr.forEach((tag, index) => {
      storefrontSearchQuery += `tag:${tag}`
      if (index < tagsArr.length - 1) {
        storefrontSearchQuery += ' AND '
      }
    })
    storefrontSearchQuery += ')'
  }*/
  console.log(storefrontSearchQuery)
  const query = `
  query {
    products(first: 10, query: "${storefrontSearchQuery}") {
      edges {
        node {
          id
          title
          description
          vendor
          productType
          tags
          priceRange {
            minVariantPrice {
              amount
            }
            maxVariantPrice {
              amount
            }
          }
          images(first: 1) {
            edges {
                node {
                    src
                }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query })
  })
  const data = await response.json()
  console.log(data)
  return {
    results: data?.data?.products?.edges?.map(item => {
      return item.node
    })
  }
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
