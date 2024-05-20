import { createStreamableValue } from 'ai/rsc'
import { searchSchema } from '@/lib/schema/search'
import { Card } from '@/components/ui/card'
import { ToolProps } from '.'
import { VideoSearchSection } from '@/components/video-search-section'

// Start Generation Here
export const videoSearchTool = ({ uiStream, fullResponse }: ToolProps) => ({
  description: 'Search for videos from YouTube',
  parameters: searchSchema,
  execute: async ({ query }: { query: string }) => {
    let hasError = false
    // Append the search section
    const streamResults = createStreamableValue<string>()
    uiStream.append(<VideoSearchSection result={streamResults.value} />)

    let searchResult
    try {
      const response = await fetch('https://google.serper.dev/videos', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query })
      })
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      searchResult = await response.json()
    } catch (error) {
      console.error('Video Search API error:', error)
      hasError = true
    }

    if (hasError) {
      fullResponse += `\nAn error occurred while searching for videos with "${query}.`
      uiStream.update(
        <Card className="p-4 mt-2 text-sm">
          {`An error occurred while searching for videos with "${query}".`}
        </Card>
      )
      return searchResult
    }

    streamResults.done(JSON.stringify(searchResult))

    return searchResult
  }
})
