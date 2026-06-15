import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

export const OLLAMA_CLOUD_API_KEY_COOKIE = 'ollama_cloud_api_key'

const MAX_OLLAMA_API_KEY_LENGTH = 512

export function sanitizeOllamaCloudApiKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (
    trimmed.length < 8 ||
    trimmed.length > MAX_OLLAMA_API_KEY_LENGTH ||
    /\s/.test(trimmed)
  ) {
    return null
  }

  return trimmed
}

export function getOllamaCloudApiKeyFromCookieStore(
  cookieStore?: ReadonlyRequestCookies
): string | undefined {
  const value = cookieStore?.get(OLLAMA_CLOUD_API_KEY_COOKIE)?.value
  return sanitizeOllamaCloudApiKey(value) ?? undefined
}

export function getConfiguredOllamaCloudApiKey(
  cookieStore?: ReadonlyRequestCookies
): string | undefined {
  return (
    getOllamaCloudApiKeyFromCookieStore(cookieStore) ??
    sanitizeOllamaCloudApiKey(process.env.OLLAMA_API_KEY) ??
    undefined
  )
}
