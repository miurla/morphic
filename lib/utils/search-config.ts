/**
 * Search provider configuration utilities
 * Provides environment-aware descriptions and guidance for search tools
 */

/**
 * Checks if a dedicated "general" search provider is available
 */
export function isGeneralSearchProviderAvailable(): boolean {
  return !!process.env.PARALLEL_API_KEY
}

/**
 * Gets the name of the current general search provider
 */
export function getGeneralSearchProviderName(): string {
  if (process.env.PARALLEL_API_KEY) {
    return 'Parallel Search'
  }
  return 'primary provider'
}

/**
 * Checks if the general search provider supports multimedia content types
 */
export function supportsMultimediaContentTypes(): boolean {
  return false
}

/**
 * Gets the appropriate search type description based on available providers
 */
export function getSearchTypeDescription(): string {
  return 'Search type is preserved for compatibility. AgriEvidence uses Parallel Search for both general and optimized searches, returning agricultural evidence snippets with trusted-source metadata.'
}

/**
 * Gets the tool description based on available providers
 */
export function getSearchToolDescription(): string {
  return 'Search the live web with Parallel for agricultural evidence. The tool enriches the user query, prioritizes trusted agricultural domains from Supabase, falls back to open-web results when needed, and returns provenance metadata.'
}

/**
 * Gets content types guidance for agent prompts
 */
export function getContentTypesGuidance(): string {
  return `- **type="general" and type="optimized":**
  - Both use Parallel Search with AgriEvidence query enrichment
  - Returns LLM-optimized snippets for agricultural evidence synthesis
  - Trusted-domain results from the Supabase sources table are preferred
  - Open-web fallback results are included only when trusted coverage is thin
  - Video/image content_types are ignored by the AgriEvidence search provider`
}

/**
 * Gets the search strategy guidance for planning mode
 */
export function getSearchStrategyGuidance(): string {
  return `Search strategy:
- Use search for every agricultural information request before answering
- Let the tool enrich the user query into scientific agricultural search queries
- Prefer trusted-source results in the returned metadata
- Use open-web fallback results only to fill gaps, and lower confidence accordingly`
}

/**
 * Gets the appropriate search provider type for "general" searches
 * Returns 'brave' if available, otherwise null to indicate fallback
 */
export function getGeneralSearchProviderType(): null {
  return null
}
