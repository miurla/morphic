import { anthropic } from '@ai-sdk/anthropic'
import { createGateway } from '@ai-sdk/gateway'
import { google } from '@ai-sdk/google'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createProviderRegistry, LanguageModel } from 'ai'

export const registry = createProviderRegistry({
  openai,
  anthropic,
  google,
  'openai-compatible': createOpenAI({
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: process.env.OPENAI_COMPATIBLE_API_BASE_URL
  }),
  gateway: createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY
  })
})

export function getModel(model: string): LanguageModel {
  return registry.languageModel(
    model as Parameters<typeof registry.languageModel>[0]
  )
}

export function isProviderEnabled(providerId: string): boolean {
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
    default:
      return false
  }
}
