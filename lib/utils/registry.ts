import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import { openai, createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createAzure } from '@ai-sdk/azure'
import { ollama } from 'ollama-ai-provider'

export const registry = createProviderRegistry({
  openai,
  anthropic,
  google,
  groq: createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
  }),
  ollama,
  azure: createAzure({
    apiKey: process.env.AZURE_API_KEY,
    resourceName: process.env.AZURE_RESOURCE_NAME
  })
})

export function getModel(model: string) {
  return registry.languageModel(model)
}

export function isProviderEnabled(providerId: string): boolean {
  switch (providerId) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'google':
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
    case 'groq':
      return !!process.env.GROQ_API_KEY
    case 'ollama':
      return true
    case 'azure':
      return !!process.env.AZURE_API_KEY && !!process.env.AZURE_RESOURCE_NAME
    default:
      return false
  }
}
