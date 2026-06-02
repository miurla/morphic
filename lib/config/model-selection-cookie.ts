export const MODEL_SELECTION_COOKIE = 'selectedModel'
export const MODEL_SELECTION_COOKIE_VERSION = 2

export interface ParsedModelSelectionCookie {
  providerId: string
  modelId: string
  version: number
}

export function serializeModelSelectionCookie(
  value: Pick<ParsedModelSelectionCookie, 'providerId' | 'modelId'>
): string {
  return `v${MODEL_SELECTION_COOKIE_VERSION}:${encodeURIComponent(
    value.providerId
  )}:${encodeURIComponent(value.modelId)}`
}

export function parseModelSelectionCookie(
  rawValue?: string | null
): ParsedModelSelectionCookie | null {
  if (!rawValue) {
    return null
  }

  const versionMatch = rawValue.match(/^v(\d+):(.+)$/)
  const encodedValue = versionMatch ? versionMatch[2] : rawValue
  const version = versionMatch ? Number(versionMatch[1]) : 1

  if (!Number.isInteger(version) || version < 1) {
    return null
  }

  const separatorIndex = encodedValue.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === encodedValue.length - 1) {
    return null
  }

  try {
    const providerId = decodeURIComponent(encodedValue.slice(0, separatorIndex))
    const modelId = decodeURIComponent(encodedValue.slice(separatorIndex + 1))

    if (!providerId || !modelId) {
      return null
    }

    return { providerId, modelId, version }
  } catch {
    return null
  }
}
