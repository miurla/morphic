import type { SearchResultItem, SearchResults } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'

/**
 * Validate if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Extract citation maps from a message's tool parts
 * Returns a map of toolCallId to citation map
 */
export function extractCitationMaps(
  message: UIMessage
): Record<string, Record<number, SearchResultItem>> {
  const citationMaps: Record<string, Record<number, SearchResultItem>> = {}

  if (!message.parts) return citationMaps

  console.log('extractCitationMaps - Processing message parts:', message.parts.length)

  message.parts.forEach((part: any, index: number) => {
    // Check for search tool output
    if (part.type === 'tool-search') {
      console.log(`Part ${index} - tool-search:`, {
        state: part.state,
        hasOutput: !!part.output,
        toolCallId: part.toolCallId,
        hasCitationMap: !!(part.output?.citationMap)
      })
      
      if (
        part.state === 'output-available' &&
        part.output &&
        part.toolCallId
      ) {
        const searchResults = part.output as SearchResults
        if (searchResults.citationMap) {
          // Store citation map with toolCallId as key
          citationMaps[part.toolCallId] = searchResults.citationMap
          console.log(`Stored citation map for toolCallId: ${part.toolCallId}`, searchResults.citationMap)
        }
      }
    }
  })

  console.log('extractCitationMaps - Final citationMaps:', citationMaps)
  return citationMaps
}

/**
 * Process citations in content, replacing [number](#toolCallId) with proper URLs
 * while keeping the display as just [number]
 */
export function processCitations(
  content: string,
  citationMaps: Record<string, Record<number, SearchResultItem>>
): string {
  if (!citationMaps || !content || Object.keys(citationMaps).length === 0) {
    console.log('processCitations - No citationMaps or content')
    return content || ''
  }

  console.log('processCitations - Input content:', content)
  console.log('processCitations - Available toolCallIds:', Object.keys(citationMaps))

  // Replace [number](#toolCallId) with [number](actual-url)
  // Also handle cases with spaces: [ number ]
  const processed = content.replace(/\[\s*(\d+)\s*\]\(#([^)]+)\)/g, (match, num, toolCallId) => {
    console.log(`processCitations - Found citation: [${num}](#${toolCallId})`)
    const citationNum = parseInt(num, 10)

    // Validate citation number bounds
    if (isNaN(citationNum) || citationNum < 1 || citationNum > 100) {
      console.log(`processCitations - Invalid citation number: ${num}`)
      return match
    }

    // Get the citation map for this toolCallId
    const citationMap = citationMaps[toolCallId]
    if (!citationMap) {
      console.log(`processCitations - No citation map found for toolCallId: ${toolCallId}`)
      return match // Keep original if no citation map found for this toolCallId
    }

    const citation = citationMap[citationNum]
    if (citation && isValidUrl(citation.url)) {
      const result = `[${num}](${encodeURI(citation.url)})`
      console.log(`processCitations - Replaced with: ${result}`)
      return result
    }

    console.log(`processCitations - No valid citation found for number ${citationNum} in toolCallId ${toolCallId}`)
    return match // Keep original if no valid citation found
  })

  console.log('processCitations - Output content:', processed)
  return processed
}
