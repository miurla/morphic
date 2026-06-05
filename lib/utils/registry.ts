import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { cookies } from 'next/headers'

import { anthropic } from '@ai-sdk/anthropic'
import { createGateway } from '@ai-sdk/gateway'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createProviderRegistry, LanguageModel } from 'ai'
import { createOllama } from 'ai-sdk-ollama'

// Strip a trailing /v1 from the configured base URL, then re-append it,
// so both shapes work for OpenAI-compatible hosts:
//   OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com
//   OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com/v1
function normalizeOpenAICompatibleBaseURL(raw: string): string {
  return raw.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1'
}

// Build providers object conditionally
const providers: Record<string, any> = {
  openai,
  anthropic,
  google,
  mistral,
  'openai-compatible': createOpenAICompatible({
    // Keep the SDK provider key stable. OPENAI_COMPATIBLE_PROVIDER_NAME is
    // only a UI label used by the model selector.
    name: 'openai-compatible',
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: normalizeOpenAICompatibleBaseURL(
      process.env.OPENAI_COMPATIBLE_API_BASE_URL || ''
    )
  }),
  nvidia: createOpenAICompatible({
    name: 'nvidia',
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: normalizeOpenAICompatibleBaseURL(
      process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com'
    )
  }),
  gateway: createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY
  }),
  cloudflare: createOpenAI({
    apiKey: process.env.CLOUDFLARE_API_TOKEN,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`
  }),
  openrouter: createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    fetch: async (url, options) => {
      let apiKey = process.env.OPENROUTER_API_KEY
      try {
        const cookieStore = await cookies()
        const userKey = cookieStore.get('openrouter_api_key')?.value
        if (userKey) {
          apiKey = userKey
        }
      } catch (e) {
        // cookies() might throw outside request context
      }

      const headers = new Headers(options?.headers)
      if (apiKey) {
        headers.set('Authorization', `Bearer ${apiKey}`)
      }
      headers.set('HTTP-Referer', 'https://github.com/outlaw-dame/morphic')
      headers.set('X-Title', 'Morphic AI Research Client')

      return fetch(url, {
        ...options,
        headers
      })
    }
  })
}

// Only add Ollama if OLLAMA_BASE_URL is configured
const ollamaProvider = process.env.OLLAMA_BASE_URL
  ? createOllama({ baseURL: process.env.OLLAMA_BASE_URL })
  : null

if (ollamaProvider) {
  providers.ollama = ollamaProvider
}

export const registry = createProviderRegistry(providers)

export function getModel(model: string): LanguageModel {
  // For Ollama models, bypass the registry to pass model-level settings
  // that ai-sdk-ollama requires (think, supportedUrls override).
  if (model.startsWith('ollama:') && ollamaProvider) {
    const modelId = model.slice('ollama:'.length)
    const lm = ollamaProvider(modelId, { think: true })

    // Ollama's Chat API only accepts base64 in the images field, not URLs.
    // Override supportedUrls to force AI SDK to download images and convert
    // them to base64 before sending to the model.
    Object.defineProperty(lm, 'supportedUrls', {
      value: {},
      configurable: true
    })

    return lm
  }

  return registry.languageModel(
    model as Parameters<typeof registry.languageModel>[0]
  )
}

export function isProviderEnabled(
  providerId: string,
  cookieStore?: ReadonlyRequestCookies
): boolean {
  switch (providerId) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'google':
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
    case 'openai-compatible':
      return (
        !!process.env.OPENAI_COMPATIBLE_API_KEY &&
        !!process.env.OPENAI_COMPATIBLE_API_BASE_URL
      )
    case 'gateway':
      return !!process.env.AI_GATEWAY_API_KEY
    case 'ollama':
      return !!process.env.OLLAMA_BASE_URL
    case 'cloudflare':
      return (
        !!process.env.CLOUDFLARE_API_TOKEN &&
        !!process.env.CLOUDFLARE_ACCOUNT_ID
      )
    case 'nvidia':
      return !!process.env.NVIDIA_API_KEY
    case 'mistral':
      return !!process.env.MISTRAL_API_KEY
    case 'openrouter': {
      const hasCookie = cookieStore
        ? !!cookieStore.get('openrouter_api_key')?.value
        : false
      return hasCookie || !!process.env.OPENROUTER_API_KEY
    }
    default:
      return false
  }
}
