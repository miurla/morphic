export interface Model {
  id: string
  name: string
  provider: string
  providerId: string
}

export const models: Model[] = [
  {
    id: 'openai:gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerId: 'openai'
  },
  {
    id: 'openai:gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    providerId: 'openai'
  },
  {
    id: 'anthropic:claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    providerId: 'anthropic'
  },
  {
    id: 'google:gemini-1.5-pro-002',
    name: 'Gemini 1.5 Pro',
    provider: 'Google Generative AI',
    providerId: 'google'
  },
  {
    id: 'groq:llama3-groq-8b-8192-tool-use-preview',
    name: 'LLama 3 Groq 8B Tool Use',
    provider: 'Groq',
    providerId: 'groq'
  },
  {
    id: 'ollama:qwen2.5',
    name: 'Qwen 2.5',
    provider: 'Ollama',
    providerId: 'ollama'
  },
  {
    id: 'azure:gpt-4o',
    name: 'GPT-4o',
    provider: 'Azure',
    providerId: 'azure'
  }
]
