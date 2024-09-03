import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { createOllama } from 'ollama-ai-provider'
import { createOpenAI } from '@ai-sdk/openai'
import { createAzure } from '@ai-sdk/azure';
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { CoreMessage } from 'ai'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getModel(useSubModel = false) {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL + '/api'
  const ollamaModel = process.env.OLLAMA_MODEL
  const ollamaSubModel = process.env.OLLAMA_SUB_MODEL
  const openaiApiBase = process.env.OPENAI_API_BASE
  const openaiApiKey = process.env.OPENAI_API_KEY
  let openaiApiModel = process.env.OPENAI_API_MODEL || 'gpt-4o'
  const azureResourceName = process.env.AZURE_RESOURCE_NAME
  const azureApiKey = process.env.AZURE_API_KEY
  let azureDeploymentName = process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4o'
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (
    !(ollamaBaseUrl && ollamaModel) &&
    !openaiApiKey &&
    !googleApiKey &&
    !anthropicApiKey
  ) {
    throw new Error(
      'Missing environment variables for Ollama, OpenAI, Azure OpenAI, Google or Anthropic'
    )
  }
  // Ollama
  if (ollamaBaseUrl && ollamaModel) {
    const ollama = createOllama({ baseURL: ollamaBaseUrl })

    if (useSubModel && ollamaSubModel) {
      return ollama(ollamaSubModel)
    }

    return ollama(ollamaModel)
  }

  if (googleApiKey) {
    return google('models/gemini-1.5-pro-latest')
  }

  if (anthropicApiKey) {
    return anthropic('claude-3-5-sonnet-20240620')
  }

  if (azureApiKey && azureResourceName) {
    const azure = createAzure({
      apiKey: azureApiKey,
      resourceName: azureResourceName
    })

    return azure.chat(azureDeploymentName)
  }

  // Fallback to OpenAI instead
  const openai = createOpenAI({
    baseURL: openaiApiBase, // optional base URL for proxies etc.
    apiKey: openaiApiKey, // optional API key, default to env property OPENAI_API_KEY
    organization: '' // optional organization
  })

  return openai.chat(openaiApiModel)
}

/**
 * Takes an array of AIMessage and modifies each message where the role is 'tool'.
 * Changes the role to 'assistant' and converts the content to a JSON string.
 * Returns the modified messages as an array of CoreMessage.
 *
 * @param aiMessages - Array of AIMessage
 * @returns modifiedMessages - Array of modified messages
 */
export function transformToolMessages(messages: CoreMessage[]): CoreMessage[] {
  return messages.map(message =>
    message.role === 'tool'
      ? {
          ...message,
          role: 'assistant',
          content: JSON.stringify(message.content),
          type: 'tool'
        }
      : message
  ) as CoreMessage[]
}

/**
 * Sanitizes a URL by replacing spaces with '%20'
 * @param url - The URL to sanitize
 * @returns The sanitized URL
 */
export function sanitizeUrl(url: string): string {
  return url.replace(/\s+/g, '%20')
}
