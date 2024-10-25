import { openai, createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import { google } from '@ai-sdk/google'
import { createOllama } from 'ollama-ai-provider'
import { createAzure } from '@ai-sdk/azure'
import { Model } from '../types/models'

export const registry = createProviderRegistry({
  openai,
  anthropic,
  google,
  groq: createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
  }),
  ollama: createOllama({
    baseURL: process.env.OLLAMA_BASE_URL
  }),
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
    default:
      return false
  }
}
