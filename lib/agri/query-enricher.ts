import { generateText } from 'ai'

import { getModel } from '../utils/registry'

/**
 * Rewrites a raw user query into 2–3 precise search queries optimised for
 * finding peer-reviewed agricultural literature.
 *
 * Uses the same generateText + getModel pattern as title-generator.ts.
 * Falls back to [userQuery] on any error so the search step is never blocked.
 */
export async function enrichQuery(
  userQuery: string,
  modelId: string
): Promise<string[]> {
  try {
    const { text } = await generateText({
      model: getModel(modelId),
      system: `You are a scientific search query specialist for agricultural research.
Your task: rewrite the user's question into exactly 2 to 3 precise search queries optimised for finding peer-reviewed agricultural literature and authoritative extension/government sources.

Rules:
- Expand informal or colloquial language into correct scientific terminology (e.g. "yellow leaves" → "chlorosis", "bug on wheat" → "wheat aphid Sitobion avenae").
- Use genus/species names (Latin binomials) where helpful.
- Add temporal context (e.g. "growing season", "spring application") only if the query implies a seasonal concern.
- Add geographic context (e.g. "Mediterranean climate", "sub-Saharan Africa") only if the user explicitly mentioned a region.
- Each query should target a different angle: causes/etiology, management/treatment, or regional/varietal specifics.
- Output ONLY a valid JSON array of strings — no explanation, no preamble, no markdown fences.

Example input: "my tomatoes have yellow leaves"
Example output: ["tomato chlorosis causes nutrient deficiency peer-reviewed", "Solanum lycopersicum leaf yellowing etiology field study", "iron manganese zinc deficiency tomato symptoms diagnosis"]`,
      prompt: userQuery
    })

    const parsed: unknown = JSON.parse(text.trim())

    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(q => typeof q === 'string' && q.trim().length > 0)
    ) {
      return (parsed as string[]).slice(0, 3)
    }

    return [userQuery]
  } catch {
    // Never block search on enricher failure
    return [userQuery]
  }
}
