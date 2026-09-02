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

const CITATION_ID_MARKER = 's'
// Short enough that the model reproduces it verbatim instead of inventing an
// id shaped like one. Collisions inside a single turn are the only risk, and a
// turn issues a handful of searches.
const CITATION_ID_LENGTH = 3

/**
 * Derive the short citation id the model is asked to cite with.
 * Provider tool call ids are long and get mangled or fabricated when a model
 * reproduces them, so citations are keyed by a short id instead. The
 * derivation is deterministic so the id can be recomputed from persisted
 * output that predates this field.
 */
export function deriveCitationId(toolCallId: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < toolCallId.length; index++) {
    hash ^= toolCallId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `${CITATION_ID_MARKER}${(hash >>> 0).toString(36).slice(-CITATION_ID_LENGTH).padStart(CITATION_ID_LENGTH, '0')}`
}

export function isCitationLabel(label: string): boolean {
  return /^[\w-]+(?:\.[\w-]+)*$/.test(label)
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

/**
 * Normalize an id for fallback matching. On top of the provider prefixes, the
 * leading marker of a citeId is dropped, because a model told not to add a
 * prefix sometimes removes that character when it cites.
 */
function normalizeCitationId(id: string): string {
  return stripToolCallPrefix(id).replace(
    new RegExp(`^${CITATION_ID_MARKER}(?=[a-z0-9]{${CITATION_ID_LENGTH}}$)`),
    ''
  )
}

/**
 * Extract citation maps from a message's tool parts
 * Returns a map of citation ids to citation maps
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
        // Keyed by both id forms so answers written before citeId existed,
        // and answers that cite the short id, both resolve.
        citationMaps[part.toolCallId] = citationMap
        const shortId =
          searchResults.citeId ?? deriveCitationId(part.toolCallId)
        // A short id is small enough to collide over a long thread. The first
        // claim wins so a citation is dropped rather than resolved to the
        // wrong source.
        if (!(shortId in citationMaps)) {
          citationMaps[shortId] = citationMap
        }
      }
    }
  })

  return citationMaps
}

/**
 * Look up a citation map by any id form a cited answer may carry: the short
 * citeId, the original toolCallId, or a toolCallId the model prefixed. Exact
 * matches are preferred so normalization cannot shadow a real id.
 */
export function resolveCitationMap(
  citationMaps: Record<string, Record<number, SearchResultItem>>,
  id: string
): Record<number, SearchResultItem> | undefined {
  if (citationMaps[id]) {
    return citationMaps[id]
  }

  const normalizedId = normalizeCitationId(id)
  return (
    citationMaps[normalizedId] ??
    citationMaps[
      Object.keys(citationMaps).find(
        key => normalizeCitationId(key) === normalizedId
      ) ?? ''
    ]
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
    // Merge citation maps from this message without overwriting: short ids can
    // collide across a long thread, and the first claim wins there too.
    for (const [id, citationMap] of Object.entries(messageCitationMaps)) {
      if (!(id in combinedCitationMaps)) {
        combinedCitationMaps[id] = citationMap
      }
    }
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

      const citationMap = resolveCitationMap(citationMaps, toolCallId)
      if (!citationMap) {
        return '' // Return empty string if no citation map found
      }

      const citation = citationMap[citationNum]
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
