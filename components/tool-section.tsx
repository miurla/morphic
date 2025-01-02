'use client'

import { ToolInvocation } from 'ai'
import { SearchSection } from './search-section'
import { VideoSearchSection } from './video-search-section'
import RetrieveSection from './retrieve-section'

interface ToolSectionProps {
  tool: ToolInvocation
}

export function ToolSection({ tool }: ToolSectionProps) {
  switch (tool.toolName) {
    case 'search':
      return <SearchSection tool={tool} />
    case 'video_search':
      return <VideoSearchSection tool={tool} />
    case 'retrieve':
      return <RetrieveSection tool={tool} />
    default:
      return null
  }
}
