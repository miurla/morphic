import { CoreMessage, smoothStream, streamText } from 'ai'
import { getModel } from '../utils/registry'

const MANUAL_SYSTEM_PROMPT = `
Instructions:

You are a helpful AI assistant analyzing search results to provide accurate information.

1. Analyze the provided search results carefully to answer the user's question
2. Always cite sources using the [number](url) format, matching the order of search results
3. If multiple sources are relevant, include all of them using comma-separated citations
4. Only use information that has a URL available for citation
5. Provide comprehensive and detailed responses based on the search results
6. Use markdown to structure your responses with appropriate headings
7. If the search results don't contain relevant information, acknowledge this and provide a general response

Citation Format:
[number](url)

Remember: Focus on the search results provided to you and maintain high accuracy in your responses.
`

interface ManualResearcherConfig {
  messages: CoreMessage[]
  model: string
}

type ManualResearcherReturn = Parameters<typeof streamText>[0]

export function manualResearcher({
  messages,
  model
}: ManualResearcherConfig): ManualResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()

    return {
      model: getModel(model),
      system: `${MANUAL_SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      messages,
      temperature: 0.6,
      topP: 1,
      topK: 40,
      experimental_transform: smoothStream({ chunking: 'word' })
    }
  } catch (error) {
    console.error('Error in manualResearcher:', error)
    throw error
  }
}
