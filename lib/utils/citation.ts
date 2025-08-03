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

  message.parts.forEach((part: any) => {
    // Check for search tool output
    if (
      part.type === 'tool-search' &&
      part.state === 'output-available' &&
      part.output &&
      part.toolCallId
    ) {
      const searchResults = part.output as SearchResults
      if (searchResults.citationMap) {
        // Store citation map with toolCallId as key
        citationMaps[part.toolCallId] = searchResults.citationMap
      }
    }
  })

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
    return content || ''
  }

  // Replace [number](#toolCallId) with [number](actual-url)
  // Also handle cases with spaces: [ number ]
  return content.replace(
    /\[\s*(\d+)\s*\]\(#([^)]+)\)/g,
    (match, num, toolCallId) => {
      const citationNum = parseInt(num, 10)

      // Validate citation number bounds
      if (isNaN(citationNum) || citationNum < 1 || citationNum > 100) {
        return match
      }

      // Get the citation map for this toolCallId
      const citationMap = citationMaps[toolCallId]
      if (!citationMap) {
        return match // Keep original if no citation map found for this toolCallId
      }

      const citation = citationMap[citationNum]
      if (citation && isValidUrl(citation.url)) {
        // Encode URI to prevent injection attacks
        return `[${num}](${encodeURI(citation.url)})`
      }

      return match // Keep original if no valid citation found
    }
  )
}
