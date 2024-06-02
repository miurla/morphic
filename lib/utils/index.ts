import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { OpenAI } from '@ai-sdk/openai'
import { createOllama } from 'ollama-ai-provider';
import { google } from '@ai-sdk/google'
import { AIMessage } from '../types'
import { CoreMessage } from 'ai'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getModel() {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL + "/api";
  const ollamaModel = process.env.OLLAMA_MODEL;
  const openaiApiBase = process.env.OPENAI_API_BASE;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  let openaiApiModel = process.env.OPENAI_API_MODEL || 'gpt-4o';

  if (
    !(ollamaBaseUrl && ollamaModel) &&
    !(openaiApiBase && openaiApiKey)
  ) {
    throw new Error('Missing environment variables for Ollama and OpenAI');
  }

  // Ollama

  if (ollamaBaseUrl && ollamaModel) {
    const ollama = createOllama({ baseURL: ollamaBaseUrl });

    return ollama(ollamaModel);
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google('models/gemini-1.5-pro-latest')
  }

  // Fallback to OpenAI instead

  const openai = new OpenAI({
    baseUrl: openaiApiBase, // optional base URL for proxies etc.
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
export function transformToolMessages(aiMessages: AIMessage[]): CoreMessage[] {
  return aiMessages.map(message =>
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
