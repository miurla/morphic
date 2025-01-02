import { CoreMessage, streamText } from 'ai'
import { getModel } from '../utils/registry'
import { searchTool } from './tools/search'
import { retrieveTool } from './tools/retrieve'
import { videoSearchTool } from './tools/video-search'

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to real-time web search, content retrieval, and video search capabilities.
When asked a question, you should:
1. Search for relevant information using the search tool when needed
2. Use the retrieve tool to get detailed content from specific URLs
3. Use the video search tool when looking for video content
4. Analyze all search results to provide accurate, up-to-date information
5. Always cite your sources when using information from any search results
6. If results are not relevant or helpful, rely on your general knowledge
7. Be concise and direct in your responses`

type ChatResearcherReturn = Parameters<typeof streamText>[0]

export function chatResearcher({
  messages,
  model
}: {
  messages: CoreMessage[]
  model: string
}): ChatResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()

    return {
      model: getModel(model),
      system: `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      messages,
      tools: {
        search: searchTool,
        retrieve: retrieveTool,
        videoSearch: videoSearchTool
      },
      maxSteps: 5
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
