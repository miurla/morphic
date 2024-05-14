import { searchTool } from './search'
import { createStreamableUI } from 'ai/rsc'

interface GetToolsProps {
  uiStream: ReturnType<typeof createStreamableUI>
  fullResponse: string
  hasError: boolean
  isFirstToolResponse: boolean
}

export const getTools = ({
  uiStream,
  fullResponse,
  hasError,
  isFirstToolResponse
}: GetToolsProps) => ({
  search: searchTool({
    uiStream,
    fullResponse,
    hasError,
    isFirstToolResponse
  })
})
