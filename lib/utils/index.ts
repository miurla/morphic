import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { OpenAI } from '@ai-sdk/openai'
import { createOllama } from 'ollama-ai-provider';

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

  // Fallback to OpenAI instead

  const openai = new OpenAI({
    baseUrl: openaiApiBase, // optional base URL for proxies etc.
    apiKey: openaiApiKey, // optional API key, default to env property OPENAI_API_KEY
    organization: '' // optional organization
  })


  return openai.chat(openaiApiModel)
}
