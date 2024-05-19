import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { OpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getModel() {
  // Currently does not work with Google or Anthropic
  // if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  //   const google = createGoogleGenerativeAI()
  //   return google('models/gemini-1.5-pro-latest')
  // }

  // if (process.env.ANTHROPIC_API_KEY) {
  //   const anthropic = createAnthropic()
  //   return anthropic('claude-3-haiku-20240307')
  // }

  const openai = new OpenAI({
    baseUrl: process.env.OPENAI_API_BASE, // optional base URL for proxies etc.
    apiKey: process.env.OPENAI_API_KEY, // optional API key, default to env property OPENAI_API_KEY
    organization: '' // optional organization
  })
  return openai.chat(process.env.OPENAI_API_MODEL || 'gpt-4o')
}
