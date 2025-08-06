import { anthropic } from '@ai-sdk/anthropic'
import { createGateway } from '@ai-sdk/gateway'
import { google } from '@ai-sdk/google'
import { createOpenAI, openai } from '@ai-sdk/openai'
import {
  createProviderRegistry,
  LanguageModel
} from 'ai'

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

export function getToolCallModel(model?: string) {
  const [provider, ...modelNameParts] = model?.split(':') ?? []
  const modelName = modelNameParts.join(':')
  switch (provider) {
    case 'google':
      return getModel('google:gemini-2.0-flash')
    case 'gateway':
      // For gateway models, we need to determine the underlying provider
      // and use an appropriate tool call model
      if (modelName?.includes('openai')) {
        return getModel('gateway:openai/gpt-4o-mini')
      } else if (modelName?.includes('anthropic')) {
        return getModel('gateway:anthropic/claude-3-5-sonnet-20241022')
      } else {
        return getModel('gateway:openai/gpt-4o-mini')
      }
    default:
      return getModel('openai:gpt-4o-mini')
  }
}

export function isToolCallSupported(model?: string) {
  const [provider, ...modelNameParts] = model?.split(':') ?? []
  const modelName = modelNameParts.join(':')

  if (provider === 'google') {
    return false
  }

  // For gateway models, check the underlying provider
  if (provider === 'gateway') {
    if (modelName?.includes('google')) {
      return false
    }
    // Most other providers support tool calling
    return true
  }

  return true
}

export function isReasoningModel(model: string): boolean {
  if (typeof model !== 'string') {
    return false
  }
  return (
    model.includes('deepseek-r1') ||
    model.includes('deepseek-reasoner') ||
    model.includes('o3-mini')
  )
}