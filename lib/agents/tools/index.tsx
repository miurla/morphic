import { createStreamableUI } from 'ai/rsc'
import { retrieveTool } from './retrieve'
import { searchTool } from './search'

export interface ToolsProps {
  uiStream: ReturnType<typeof createStreamableUI>
  fullResponse: string
  isFirstToolResponse: boolean
}

export const getTools = ({
  uiStream,
  fullResponse,
  isFirstToolResponse
}: ToolsProps) => {
  const tools: any = {
    search: searchTool({
      uiStream,
      fullResponse,
      isFirstToolResponse
    }),
    retrieve: retrieveTool({
      uiStream,
      fullResponse,
      isFirstToolResponse
    })
  }

  return tools
}
