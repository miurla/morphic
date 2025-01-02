import { CoreMessage, streamText } from 'ai'
import { getModel } from '../utils/registry'
import { searchTool } from './tools/search'

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to real-time web search capabilities.
When asked a question, you should:
1. Search for relevant information using the search tool when needed
2. Analyze the search results and provide accurate, up-to-date information
3. Always cite your sources when using information from search results
4. If search results are not relevant or helpful, rely on your general knowledge
5. Be concise and direct in your responses

Remember to:
- Use search for current events, facts, or when you need to verify information
- Clearly indicate when you're using search results vs. your general knowledge
- Admit if you cannot find relevant information for a query`

type ChatResearcherReturn = Parameters<typeof streamText>[0]

export async function chatResearcher({
  messages,
  model
}: {
  messages: CoreMessage[]
  model: string
}): Promise<ChatResearcherReturn> {
  try {
    const currentDate = new Date().toLocaleString()

    return {
      model: getModel(model),
      system: `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      messages,
      tools: { search: searchTool },
      maxSteps: 5
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
