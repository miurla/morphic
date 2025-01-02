import { CoreMessage, streamText } from 'ai'
import { getModel } from '../utils/registry'
import { searchTool } from './tools/search'
import { retrieveTool } from './tools/retrieve'

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to real-time web search capabilities and content retrieval.
When asked a question, you should:
1. Search for relevant information using the search tool when needed
2. Use the retrieve tool to get detailed content from specific URLs
3. Analyze the search and retrieved results to provide accurate, up-to-date information
4. Always cite your sources when using information from search or retrieved content
5. If results are not relevant or helpful, rely on your general knowledge
6. Be concise and direct in your responses

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
      tools: { search: searchTool, retrieve: retrieveTool },
      maxSteps: 5
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
