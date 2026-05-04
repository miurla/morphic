import { generateText } from 'ai'

import { getModel } from '../utils/registry'

const QUERY_ENRICHER_MODEL = 'deepseek:deepseek-v4-flash'
const QUERY_ENRICHER_TIMEOUT_MS = 3000

function cleanQueryLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

function parseQueryLines(text: string): string[] {
  return text
    .split('\n')
    .map(cleanQueryLine)
    .filter(line => line.length > 0 && !line.startsWith('```'))
    .slice(0, 3)
}

/**
 * Rewrites a raw user query into 2–3 precise search queries optimised for
 * finding peer-reviewed agricultural literature.
 *
 * Uses the same generateText + getModel pattern as title-generator.ts.
 * Falls back to [userQuery] on any error so the search step is never blocked.
 */
export async function enrichQuery(userQuery: string): Promise<string[]> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort()
        reject(new Error('Query enrichment timed out'))
      }, QUERY_ENRICHER_TIMEOUT_MS)
    })

    const { text } = await Promise.race([
      generateText({
        model: getModel(QUERY_ENRICHER_MODEL),
        system: `You are a scientific search query specialist for agricultural research.
Your task: rewrite the user's question into two to three precise search queries optimized for finding peer-reviewed agricultural literature and authoritative extension/government sources.

Rules:
- Expand informal or colloquial language into correct scientific terminology where applicable.
- Add the most relevant crop species scientific name if the crop is identifiable.
- Add temporal context only if the user explicitly mentions a season.
- Add geographic context (e.g. "Mediterranean climate", "sub-Saharan Africa") only if the user explicitly mentioned a region.
- Each query should target a different angle: cause/etiology, management/treatment, regulatory status, or regional/varietal specifics.
- Return only the query strings with no explanation, preamble, bullets, numbering, or formatting.
- Put one query per line.

Example input: "my tomatoes have yellow leaves"
Example output:
tomato chlorosis nutrient deficiency diagnosis peer-reviewed
Solanum lycopersicum leaf yellowing etiology field study
iron manganese zinc deficiency tomato symptoms diagnosis`,
        prompt: userQuery,
        abortSignal: controller.signal
      }),
      timeoutPromise
    ])

    const queries = parseQueryLines(text)

    if (queries.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[QueryEnricher] enriched queries:', queries)
      }

      return queries
    }

    return [userQuery]
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[QueryEnricher] falling back to raw query:', error)
    }

    // Never block search on enricher failure
    return [userQuery]
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
