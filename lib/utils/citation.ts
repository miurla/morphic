import type { SearchResultItem, SearchResults } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'
import { displayUrlName } from '@/lib/utils/domain'

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

export function isCitationLabel(label: string): boolean {
  return /^[\w-]+(?:\.[\w-]+)*$/.test(label)
}

const DERIVED_LABEL_PATTERN = /^S\d+$/

export function isDerivedLabel(label: string): boolean {
  return DERIVED_LABEL_PATTERN.test(label)
}

/**
 * Strip a known provider/router prefix from a toolCallId.
 * Some models prepend their own prefix (e.g. `toolu_`) to the search tool's
 * call id when citing, which breaks an exact-match lookup. Normalizing both the
 * cited id and the citation map keys lets these citations still resolve.
 */
function stripToolCallPrefix(toolCallId: string): string {
  return toolCallId.replace(/^(toolu_|call_|search-)/, '')
}

export function nextCitationLabelNumber(messages: UIMessage[]): number {
  let maxLabelNumber = 0

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (
        part.type !== 'tool-search' ||
        part.state !== 'output-available' ||
        !part.output
      ) {
        continue
      }

      const searchResults = part.output as SearchResults
      for (const result of searchResults.results ?? []) {
        if (result.label && isDerivedLabel(result.label)) {
          maxLabelNumber = Math.max(
            maxLabelNumber,
            Number(result.label.slice(1))
          )
        }
      }
    }
  }

  return maxLabelNumber + 1
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

      // Prefer citationMap when present (older persisted messages still carry
      // it). Newer search outputs omit the redundant citationMap, so derive it
      // from results by index (citation N -> results[N-1]).
      let citationMap = searchResults.citationMap
      if (!citationMap && Array.isArray(searchResults.results)) {
        citationMap = {}
        searchResults.results.forEach((result, index) => {
          citationMap![index + 1] = result // Citation numbers start at 1
        })
      }

      if (citationMap && Object.keys(citationMap).length > 0) {
        // Store citation map with toolCallId as key
        citationMaps[part.toolCallId] = citationMap
      }

      for (const result of searchResults.results ?? []) {
        if (
          result.label &&
          isDerivedLabel(result.label) &&
          !citationMaps[result.label]
        ) {
          citationMaps[result.label] = { 1: result }
        }
      }
    }
  })

  return citationMaps
}

export function resolveCitation(
  citationMaps: Record<string, Record<number, SearchResultItem>>,
  id: string,
  citationNumber: number
): SearchResultItem | undefined {
  let citationMap = citationMaps[id]
  if (!citationMap) {
    const normalizedId = stripToolCallPrefix(id)
    citationMap =
      citationMaps[normalizedId] ??
      citationMaps[
        Object.keys(citationMaps).find(
          key => stripToolCallPrefix(key) === normalizedId
        ) ?? ''
      ]
  }

  return (
    citationMap?.[citationNumber] ??
    (citationMap && isDerivedLabel(id) ? citationMap[1] : undefined)
  )
}

/**
 * Extract citation maps from multiple messages
 * Returns a combined map of toolCallId to citation map
 */
export function extractCitationMapsFromMessages(
  messages: UIMessage[]
): Record<string, Record<number, SearchResultItem>> {
  const combinedCitationMaps: Record<
    string,
    Record<number, SearchResultItem>
  > = {}

  messages.forEach(message => {
    const messageCitationMaps = extractCitationMaps(message)
    // Merge citation maps from this message
    Object.assign(combinedCitationMaps, messageCitationMaps)
  })

  return combinedCitationMaps
}

/**
 * Process citations in content, replacing [number](#toolCallId) with [domain](url)
 * Display text uses domain name instead of number (e.g., [google](url))
 */
export function processCitations(
  content: string,
  citationMaps: Record<string, Record<number, SearchResultItem>>
): string {
  if (!citationMaps || !content || Object.keys(citationMaps).length === 0) {
    return content || ''
  }

  // Replace [number](#toolCallId) with [domain](actual-url)
  // Also handle cases with spaces: [ number ]
  return content.replace(
    /\[\s*(\d+)\s*\]\(#([^)]+)\)/g,
    (_match, num, toolCallId) => {
      const citationNum = parseInt(num, 10)

      // Validate citation number bounds
      if (isNaN(citationNum) || citationNum < 1 || citationNum > 100) {
        return '' // Return empty string for invalid citation numbers
      }

      const citation = resolveCitation(citationMaps, toolCallId, citationNum)
      if (!citation || !isValidUrl(citation.url)) {
        return '' // Return empty string for invalid citations
      }

      // Extract domain name from URL (removes TLD and subdomain)
      const domainName = displayUrlName(citation.url)

      // Encode URI to prevent injection attacks
      return `[${domainName}](${encodeURI(citation.url)})`
    }
  )
}
