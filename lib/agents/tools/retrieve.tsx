import { retrieveSchema } from '@/lib/schema/retrieve'
import { ToolsProps } from '.'
import { Card } from '@/components/ui/card'
import { SearchSkeleton } from '@/components/search-skeleton'
import { SearchResults as SearchResultsType } from '@/lib/types'
import Exa from 'exa-js'
import RetrieveSection from '@/components/retrieve-section'

const apiKey = process.env.EXA_API_KEY
const exa = new Exa(apiKey)

export const retrieveTool = ({
  uiStream,
  fullResponse,
  isFirstToolResponse
}: ToolsProps) => ({
  description: 'Retrieve content from the web',
  parameters: retrieveSchema,
  execute: async ({ urls }: { urls: string[] }) => {
    let hasError = false
    // If this is the first tool response, remove spinner
    if (isFirstToolResponse) {
      isFirstToolResponse = false
      uiStream.update(null)
    }
    // Append the search section
    uiStream.append(<SearchSkeleton />)

    let results: SearchResultsType | undefined
    try {
      const data = await exa.getContents(urls)

      if (data.results.length === 0) {
        hasError = true
      } else {
        results = {
          results: data.results.map((result: any) => ({
            title: result.title,
            content: result.text,
            url: result.url
          })),
          query: '',
          images: []
        }
      }
    } catch (error) {
      hasError = true
      console.error('Retrieve API error:', error)

      fullResponse += `\n${error} "${urls.join(', ')}".`

      uiStream.update(
        <Card className="p-4 mt-2 text-sm">
          {`${error} "${urls.join(', ')}".`}
        </Card>
      )
      return results
    }

    if (hasError || !results) {
      fullResponse += `\nAn error occurred while retrieving "${urls.join(
        ', '
      )}".`
      uiStream.update(
        <Card className="p-4 mt-2 text-sm">
          {`An error occurred while retrieving "${urls.join(
            ', '
          )}".This webiste may not be supported.`}
        </Card>
      )
      return results
    }

    uiStream.update(<RetrieveSection data={results} />)

    return results
  }
})
