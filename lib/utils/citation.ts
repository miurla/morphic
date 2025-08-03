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
 * Extract citation map from a message's tool parts
 * Looks for search tool outputs and combines their citation maps
 */
export function extractCitationMap(message: UIMessage): Record<number, SearchResultItem> | undefined {
  if (!message.parts) return undefined

  const citationMap: Record<number, SearchResultItem> = {}
  
  message.parts.forEach((part: any) => {
    // Check for search tool output
    if (part.type === 'tool-search' && part.state === 'output-available' && part.output) {
      const searchResults = part.output as SearchResults
      if (searchResults.citationMap) {
        // Merge citation maps from multiple search tools
        Object.assign(citationMap, searchResults.citationMap)
      }
    }
  })

  return Object.keys(citationMap).length > 0 ? citationMap : undefined
}

/**
 * Process citations in content, replacing [number](#) with proper URLs
 * while keeping the display as just [number]
 */
export function processCitations(
  content: string, 
  citationMap?: Record<number, SearchResultItem>
): string {
  if (!citationMap || !content) {
    return content || ''
  }
  
  // Replace [number](#) with [number](actual-url)
  // Also handle cases with spaces: [ number ]
  return content.replace(
    /\[\s*(\d+)\s*\]\(#\)/g,
    (match, num) => {
      const citationNum = parseInt(num, 10)
      
      // Validate citation number bounds
      if (isNaN(citationNum) || citationNum < 1 || citationNum > 100) {
        return match
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