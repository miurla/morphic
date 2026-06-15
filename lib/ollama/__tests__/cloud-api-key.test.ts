import { afterEach, describe, expect, it } from 'vitest'

import {
  getConfiguredOllamaCloudApiKey,
  sanitizeOllamaCloudApiKey
} from '../cloud-api-key'

function cookieStore(value?: string) {
  return {
    get: (name: string) =>
      name === 'ollama_cloud_api_key' && value ? { name, value } : undefined
  } as any
}

describe('Ollama Cloud API key handling', () => {
  afterEach(() => {
    delete process.env.OLLAMA_API_KEY
  })

  it('rejects blank, whitespace, and oversized keys', () => {
    expect(sanitizeOllamaCloudApiKey('')).toBeNull()
    expect(sanitizeOllamaCloudApiKey('bad key')).toBeNull()
    expect(sanitizeOllamaCloudApiKey('x'.repeat(513))).toBeNull()
  })

  it('prefers the user cookie over the environment key', () => {
    process.env.OLLAMA_API_KEY = 'ollama-env-key'

    expect(getConfiguredOllamaCloudApiKey(cookieStore('ollama-user-key'))).toBe(
      'ollama-user-key'
    )
  })

  it('falls back to the environment key', () => {
    process.env.OLLAMA_API_KEY = 'ollama-env-key'

    expect(getConfiguredOllamaCloudApiKey(cookieStore())).toBe('ollama-env-key')
  })
})
