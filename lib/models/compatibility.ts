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
