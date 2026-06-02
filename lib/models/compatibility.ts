const NVIDIA_SEARCH_COMPATIBLE_PATTERNS = [
  /^meta\/llama-3\..*-instruct$/i,
  /^nvidia\/llama-3\.1-nemotron.*instruct$/i
]

export function isSearchCompatibleModel(
  providerId: string,
  modelId: string
): boolean {
  if (providerId === 'nvidia') {
    return NVIDIA_SEARCH_COMPATIBLE_PATTERNS.some(pattern =>
      pattern.test(modelId)
    )
  }

  return true
}

export function getSearchModelPreferenceScore(
  providerId: string,
  modelId: string
): number {
  if (providerId === 'nvidia') {
    const normalizedId = modelId.toLowerCase()
    if (normalizedId === 'meta/llama-3.1-8b-instruct') return 0
    if (normalizedId === 'meta/llama-3.1-70b-instruct') return 10
    if (
      normalizedId.includes('nemotron') &&
      normalizedId.includes('instruct')
    ) {
      return 20
    }
  }

  return 100
}
